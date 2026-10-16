using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

/// <summary>
/// Service responsible for orchestrating Streamlit code generation
/// across all components and event handlers
/// </summary>
public class StreamlitGenerationService : IStreamlitGenerationService
{
    private readonly IComponentRegistryService _registryService;
    private WorkflowDefinitionDto _workflowDefinition = new();

    public StreamlitGenerationService(IComponentRegistryService registryService)
    {
        _registryService = registryService;
    }

    /// <inheritdoc/>
    public string GenerateComponentCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        if (!IsComponentRuntimeTypeValid(component))
        {
            throw new InvalidOperationException($"Component payload type mismatch for {component.Type}. Actual DTO: {component.GetType().Name}.");
        }

        var services = _registryService.GetComponentServices();

        if (services.TryGetValue(component.Type, out var service))
        {
            // Set this generation service on the component service for recursive calls
            service.SetGenerationService(this);
            return service.GenerateStreamlitCode(component, indentation, allComponents);
        }

        return $"{indentation}st.error('Unknown component type: {component.Type}')";
    }

    public void SetWorkflowDefinition(WorkflowDefinitionDto workflowDefinition)
    {
        _workflowDefinition = workflowDefinition ?? new WorkflowDefinitionDto();
    }

    public string? GetTriggerHandlerName(VdabComponentDto component, string eventName)
    {
        if (string.IsNullOrWhiteSpace(component.CodeName))
        {
            return null;
        }

        WorkflowDto? workflow = _workflowDefinition.Workflows.FirstOrDefault(candidate =>
            string.Equals(candidate.Trigger.ComponentCodeName, component.CodeName, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(candidate.Trigger.EventKey, eventName, StringComparison.OrdinalIgnoreCase));

        return workflow == null ? null : $"handle_workflow_{workflow.CodeName}";
    }

    private static bool IsComponentRuntimeTypeValid(VdabComponentDto component)
    {
        return component.Type switch
        {
            ComponentType.TextInput => component is TextInputComponentDto,
            ComponentType.Toggle => component is ToggleComponentDto,
            ComponentType.Dropdown => component is DropdownComponentDto,
            ComponentType.DatePicker => component is DatePickerComponentDto,
            ComponentType.TimePicker => component is TimePickerComponentDto,
            ComponentType.Slider => component is SliderComponentDto,
            ComponentType.Columns => component is ColumnsComponentDto,
            ComponentType.Rows => component is RowsComponentDto,
            ComponentType.Checkbox => component is CheckboxComponentDto,
            ComponentType.Button => component is ButtonComponentDto,
            ComponentType.DataWindow => component is DataWindowComponentDto,
            ComponentType.EditableDataWindow => component is EditableDataWindowComponentDto,
            ComponentType.Form => component is FormComponentDto,
            ComponentType.Modal => component is ModalComponentDto,
            ComponentType.FileUpload => component is FileUploadComponentDto,
            ComponentType.Label => component is LabelComponentDto,
            ComponentType.BarChart => component is BarChartComponentDto,
            ComponentType.LineChart => component is LineChartComponentDto,
            ComponentType.PieChart => component is PieChartComponentDto,
            ComponentType.DonutChart => component is DonutChartComponentDto,
            ComponentType.AmoebaStory => component is AmoebaStoryComponentDto,
            ComponentType.NetworkWebStory => component is NetworkWebStoryComponentDto,
            ComponentType.TerrainStory => component is TerrainStoryComponentDto,
            ComponentType.HeatMapStory => component is HeatMapStoryComponentDto,
            ComponentType.PulseWaveStory => component is PulseWaveStoryComponentDto,
            ComponentType.FlowFieldStory => component is FlowFieldStoryComponentDto,
            ComponentType.HoneycombStory => component is HoneycombStoryComponentDto,
            ComponentType.SpiralStory => component is SpiralStoryComponentDto,
            ComponentType.Tabs => component is TabsComponentDto,
            ComponentType.Expander => component is ExpanderComponentDto,
            ComponentType.DashboardEmbed => component is DashboardEmbedComponentDto,
            ComponentType.GenieChat => component is GenieChatComponentDto,
            ComponentType.ModelChat => component is ModelChatComponentDto,
            _ => false
        };
    }
}
