using System.ComponentModel;
using System.Text.Json;
using Microsoft.SemanticKernel;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Semantic Kernel plugin that accumulates canvas and workflow operations
/// emitted by the AI builder agent.
/// </summary>
internal sealed partial class CanvasToolPlugin
{
    private static readonly Dictionary<ComponentType, List<string>> _supportedEventsMap = new()
    {
        [ComponentType.Button]             = ["onClick"],
        [ComponentType.TextInput]          = ["onChange"],
        [ComponentType.Checkbox]           = ["onChange"],
        [ComponentType.Toggle]             = ["onChange"],
        [ComponentType.Dropdown]           = ["onChange"],
        [ComponentType.Slider]             = ["onChange"],
        [ComponentType.DatePicker]         = ["onChange"],
        [ComponentType.TimePicker]         = ["onChange"],
        [ComponentType.Form]               = ["onSubmit"],
        [ComponentType.FileUpload]         = ["onChange"],
        [ComponentType.EditableDataWindow] = ["onChange"],
    };

    private static readonly Dictionary<ComponentType, List<string>> _supportedBindingsMap = new()
    {
        [ComponentType.FileUpload]         = ["databricksVolume"],
        [ComponentType.DataWindow]         = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.EditableDataWindow] = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.BarChart]           = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.LineChart]          = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.PieChart]           = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.DonutChart]         = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.AmoebaStory]        = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.NetworkWebStory]    = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.TerrainStory]       = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.HeatMapStory]       = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.PulseWaveStory]     = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.FlowFieldStory]     = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.HoneycombStory]     = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
        [ComponentType.SpiralStory]        = ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"],
    };

    private static readonly Dictionary<ComponentType, ComponentCategory> _categoryMap = new()
    {
        [ComponentType.TextInput]          = ComponentCategory.Controls,
        [ComponentType.Button]             = ComponentCategory.Controls,
        [ComponentType.Checkbox]           = ComponentCategory.Controls,
        [ComponentType.Toggle]             = ComponentCategory.Controls,
        [ComponentType.Dropdown]           = ComponentCategory.Controls,
        [ComponentType.DatePicker]         = ComponentCategory.Controls,
        [ComponentType.TimePicker]         = ComponentCategory.Controls,
        [ComponentType.Slider]             = ComponentCategory.Controls,
        [ComponentType.Label]              = ComponentCategory.Controls,
        [ComponentType.Columns]            = ComponentCategory.Layout,
        [ComponentType.Rows]               = ComponentCategory.Layout,
        [ComponentType.Form]               = ComponentCategory.Layout,
        [ComponentType.Modal]              = ComponentCategory.Layout,
        [ComponentType.Tabs]               = ComponentCategory.Layout,
        [ComponentType.Expander]           = ComponentCategory.Layout,
        [ComponentType.DataWindow]         = ComponentCategory.Data,
        [ComponentType.EditableDataWindow] = ComponentCategory.Data,
        [ComponentType.FileUpload]         = ComponentCategory.Data,
        [ComponentType.GenieChat]          = ComponentCategory.Data,
        [ComponentType.ModelChat]          = ComponentCategory.Visualization,
        [ComponentType.BarChart]           = ComponentCategory.Visualization,
        [ComponentType.LineChart]          = ComponentCategory.Visualization,
        [ComponentType.PieChart]           = ComponentCategory.Visualization,
        [ComponentType.DonutChart]         = ComponentCategory.Visualization,
        [ComponentType.AmoebaStory]        = ComponentCategory.Visualization,
        [ComponentType.NetworkWebStory]    = ComponentCategory.Visualization,
        [ComponentType.TerrainStory]       = ComponentCategory.Visualization,
        [ComponentType.HeatMapStory]       = ComponentCategory.Visualization,
        [ComponentType.PulseWaveStory]     = ComponentCategory.Visualization,
        [ComponentType.FlowFieldStory]     = ComponentCategory.Visualization,
        [ComponentType.HoneycombStory]     = ComponentCategory.Visualization,
        [ComponentType.SpiralStory]        = ComponentCategory.Visualization,
        [ComponentType.DashboardEmbed]     = ComponentCategory.Visualization,
    };

    private readonly List<CanvasOperationDto> _operations = [];
    private readonly Dictionary<string, ComponentType> _componentTypeById;
    private readonly Dictionary<string, string> _componentIdByCodeName;
    private readonly Dictionary<string, WorkflowSummaryDto> _existingWorkflowByCodeName;
    private readonly HashSet<string> _workflowTriggerKeys;
    private readonly Dictionary<string, WorkflowDto> _pendingWorkflows = [];
    private readonly int _workspaceConnectionId;

    private static string BuildProps(object props) => JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);

    public CanvasToolPlugin(List<CanvasComponentSummaryDto> currentComponents, List<WorkflowSummaryDto> currentWorkflows, int workspaceConnectionId = 0)
    {
        _workspaceConnectionId = workspaceConnectionId;
        _componentTypeById = new Dictionary<string, ComponentType>(StringComparer.OrdinalIgnoreCase);
        _componentIdByCodeName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        _existingWorkflowByCodeName = new Dictionary<string, WorkflowSummaryDto>(StringComparer.OrdinalIgnoreCase);
        _workflowTriggerKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (CanvasComponentSummaryDto component in currentComponents)
        {
            if (!string.IsNullOrWhiteSpace(component.CodeName) && !string.IsNullOrWhiteSpace(component.Id))
                _componentIdByCodeName[component.CodeName] = component.Id;

            if (!string.IsNullOrWhiteSpace(component.Id)
                && Enum.TryParse(component.Type, ignoreCase: true, out ComponentType parsedType))
            {
                _componentTypeById[component.Id] = parsedType;
            }
        }

        foreach (WorkflowSummaryDto workflow in currentWorkflows)
        {
            if (string.IsNullOrWhiteSpace(workflow.CodeName))
                continue;

            _existingWorkflowByCodeName[workflow.CodeName] = workflow;
            _workflowTriggerKeys.Add(AiBuilderWorkflowKeys.BuildTriggerKey(workflow.TriggerComponentCodeName, workflow.TriggerEventKey));
        }
    }

    public List<CanvasOperationDto> GetOperations()
    {
        List<CanvasOperationDto> all = [.. _operations];
        foreach (WorkflowDto workflow in _pendingWorkflows.Values)
            all.Add(new CanvasOperationDto { Op = "addWorkflow", Workflow = workflow });
        return all;
    }

    [KernelFunction]
    [Description("Replace the app's custom_modules.py source. Use this before adding CallCustomModule actions for newly created functions. Keep existing useful functions unless replacing them intentionally.")]
    public string UpdateCustomModulesCode(
        [Description("Complete Python source for custom_modules.py, including all functions that should remain available")] string pythonSource)
    {
        string normalizedSource = CustomModulesTemplate.ResolveContent(pythonSource);
        _operations.Add(new CanvasOperationDto
        {
            Op = "updateCustomModulesCode",
            CustomModulesCode = normalizedSource,
        });

        return "custom_modules.py";
    }

    private string AddComponent(ComponentType componentType, string defaultCodeName, string codeName, string? parentId, int tabIndex, string propsJson)
    {
        if (string.IsNullOrWhiteSpace(codeName))
            codeName = defaultCodeName;
        if (string.IsNullOrWhiteSpace(propsJson))
            propsJson = "{}";

        if (_componentIdByCodeName.ContainsKey(codeName))
            throw new InvalidOperationException($"Component codeName '{codeName}' already exists. Choose a unique codeName.");

        string? resolvedParentId = ResolveOptionalParentId(parentId);

        string id = Guid.NewGuid().ToString();
        VdabComponentDto? component = CreateComponent(componentType, id, codeName, propsJson);
        if (component is null)
            throw new InvalidOperationException($"Unsupported component type: {componentType}");

        _operations.Add(new CanvasOperationDto { Op = "add", Component = component, ParentId = resolvedParentId, TabIndex = tabIndex });

        _componentTypeById[id] = componentType;
        _componentIdByCodeName[codeName] = id;
        return id;
    }

    private string? ResolveOptionalParentId(string? parentId)
    {
        if (string.IsNullOrWhiteSpace(parentId))
            return null;

        if (_componentTypeById.ContainsKey(parentId))
            return parentId;

        if (_componentIdByCodeName.TryGetValue(parentId, out string? resolvedId) && !string.IsNullOrWhiteSpace(resolvedId))
            return resolvedId;

        throw new InvalidOperationException($"Unknown parent reference '{parentId}'. Use an existing parent id or codeName from canvas state.");
    }

    private string ResolveRequiredParentId(string parentIdOrCodeName)
    {
        string? resolvedParentId = ResolveOptionalParentId(parentIdOrCodeName);
        if (string.IsNullOrWhiteSpace(resolvedParentId))
            throw new InvalidOperationException("A valid parent id or codeName is required for nested components.");
        return resolvedParentId;
    }

    private string ResolveComponentId(string componentId, string codeName)
    {
        if (!string.IsNullOrWhiteSpace(componentId))
            return componentId;

        if (!string.IsNullOrWhiteSpace(codeName)
            && _componentIdByCodeName.TryGetValue(codeName, out string? resolvedId)
            && !string.IsNullOrWhiteSpace(resolvedId))
        {
            return resolvedId;
        }

        throw new InvalidOperationException("You must provide either a valid componentId or a known codeName.");
    }

    private static void ValidatePropsJsonForRequiredFields(ComponentType type, string propsJson)
    {
        bool isValid = type switch
        {
            ComponentType.Dropdown => Deserialize<DropdownProps>(propsJson) is not null,
            ComponentType.Checkbox => Deserialize<CheckboxProps>(propsJson) is not null,
            ComponentType.Toggle   => Deserialize<ToggleProps>(propsJson)   is not null,
            ComponentType.Button   => Deserialize<ButtonProps>(propsJson)   is not null,
            _ => true,
        };

        if (isValid)
            return;

        string hint = type switch
        {
            ComponentType.Dropdown => """{"label":"...","options":[{"value":"..."}],"placeholder":"","multiselect":false}""",
            ComponentType.Checkbox => """{"label":"...","defaultChecked":false}""",
            ComponentType.Toggle   => """{"label":"...","defaultValue":false}""",
            ComponentType.Button   => """{"label":"..."}""",
            _ => string.Empty,
        };

        throw new InvalidOperationException(
            $"propsJson for {type} is missing one or more required fields. Expected shape: {hint}");
    }

    private static T? Deserialize<T>(string json)
    {
        try { return JsonSerializer.Deserialize<T>(json, AiBuilderJsonOptions.CamelCase); }
        catch { return default; }
    }

    private static VdabComponentDto? CreateComponent(ComponentType type, string id, string codeName, string propsJson)
    {
        ComponentCategory category = _categoryMap.GetValueOrDefault(type, ComponentCategory.Controls);
        List<string>? supportedEvents = _supportedEventsMap.GetValueOrDefault(type);
        List<string>? supportedBindings = _supportedBindingsMap.GetValueOrDefault(type);

        return type switch
        {
            ComponentType.Label              => new LabelComponentDto              { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<LabelProps>(propsJson)              ?? new LabelProps { Text = "Label" } },
            ComponentType.TextInput          => new TextInputComponentDto          { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<TextInputProps>(propsJson)          ?? new TextInputProps { Label = "Text Input", Multiline = false } },
            ComponentType.Button             => new ButtonComponentDto             { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<ButtonProps>(propsJson)             ?? new ButtonProps { Label = "Button" } },
            ComponentType.Checkbox           => new CheckboxComponentDto           { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<CheckboxProps>(propsJson)           ?? new CheckboxProps { Label = "Checkbox", DefaultChecked = false } },
            ComponentType.Toggle             => new ToggleComponentDto             { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<ToggleProps>(propsJson)             ?? new ToggleProps { Label = "Toggle", DefaultValue = false } },
            ComponentType.Dropdown           => new DropdownComponentDto           { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<DropdownProps>(propsJson)           ?? new DropdownProps { Label = "Dropdown", Options = [], Multiselect = false } },
            ComponentType.Slider             => new SliderComponentDto             { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<SliderProps>(propsJson)             ?? new SliderProps { Label = "Slider", Ranged = false } },
            ComponentType.DatePicker         => new DatePickerComponentDto         { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<DatePickerProps>(propsJson)         ?? new DatePickerProps() { Label = "Date Picker" } },
            ComponentType.TimePicker         => new TimePickerComponentDto         { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<TimePickerProps>(propsJson)         ?? new TimePickerProps() { Label = "Time Picker" } },
            ComponentType.DataWindow         => new DataWindowComponentDto         { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<DataWindowProps>(propsJson)         ?? new DataWindowProps() },
            ComponentType.EditableDataWindow => new EditableDataWindowComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<EditableDataWindowProps>(propsJson) ?? new EditableDataWindowProps() },
            ComponentType.Form => new FormComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<FormProps>(propsJson) ?? new FormProps() },
            ComponentType.Columns => new ColumnsComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<ColumnsProps>(propsJson) ?? new ColumnsProps() },
            ComponentType.Rows => new RowsComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<RowsProps>(propsJson) ?? new RowsProps() },
            ComponentType.Tabs => new TabsComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<TabsProps>(propsJson) ?? new TabsProps { Tabs = ["Tab 1"] } },
            ComponentType.Expander => new ExpanderComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<ExpanderProps>(propsJson) ?? new ExpanderProps() },
            ComponentType.Modal => new ModalComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<ModalProps>(propsJson) ?? new ModalProps() },
            ComponentType.FileUpload => new FileUploadComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<FileUploadProps>(propsJson) ?? new FileUploadProps() },
            ComponentType.BarChart => new BarChartComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<BarChartProps>(propsJson) ?? new BarChartProps() },
            ComponentType.LineChart => new LineChartComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<LineChartProps>(propsJson) ?? new LineChartProps() },
            ComponentType.PieChart => new PieChartComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<PieChartProps>(propsJson) ?? new PieChartProps() },
            ComponentType.DonutChart => new DonutChartComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<DonutChartProps>(propsJson) ?? new DonutChartProps() },
            ComponentType.AmoebaStory => new AmoebaStoryComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<AmoebaStoryProps>(propsJson) ?? StoryComponentDefaults.CreateAmoebaProps() },
            ComponentType.NetworkWebStory => new NetworkWebStoryComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<NetworkWebStoryProps>(propsJson) ?? StoryComponentDefaults.CreateNetworkWebProps() },
            ComponentType.TerrainStory => new TerrainStoryComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<TerrainStoryProps>(propsJson) ?? StoryComponentDefaults.CreateTerrainProps() },
            ComponentType.HeatMapStory => new HeatMapStoryComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<HeatMapStoryProps>(propsJson) ?? StoryComponentDefaults.CreateHeatMapProps() },
            ComponentType.PulseWaveStory => new PulseWaveStoryComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<PulseWaveStoryProps>(propsJson) ?? StoryComponentDefaults.CreatePulseWaveProps() },
            ComponentType.FlowFieldStory => new FlowFieldStoryComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<FlowFieldStoryProps>(propsJson) ?? StoryComponentDefaults.CreateFlowFieldProps() },
            ComponentType.HoneycombStory => new HoneycombStoryComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<HoneycombStoryProps>(propsJson) ?? StoryComponentDefaults.CreateHoneycombProps() },
            ComponentType.SpiralStory => new SpiralStoryComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<SpiralStoryProps>(propsJson) ?? StoryComponentDefaults.CreateSpiralProps() },
            ComponentType.DashboardEmbed => new DashboardEmbedComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<DashboardEmbedProps>(propsJson) ?? new DashboardEmbedProps() },
            ComponentType.GenieChat => new GenieChatComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<GenieChatProps>(propsJson) ?? new GenieChatProps() },
            ComponentType.ModelChat => new ModelChatComponentDto { Id = id, CodeName = codeName, Type = type, Category = category, SchemaVersion = 1, SupportedEvents = supportedEvents, SupportedBindings = supportedBindings, Props = Deserialize<ModelChatProps>(propsJson) ?? new ModelChatProps() },
            _ => null,
        };
    }

    // Used by AddBuildSqlAction in CanvasToolPlugin.Workflows.cs
    private sealed class PlaceholderRefDto
    {
        public string Token { get; set; } = string.Empty;
        public string ComponentCodeName { get; set; } = string.Empty;
        public string ValueType { get; set; } = "string";
        public string? FormatHint { get; set; }
    }
}
