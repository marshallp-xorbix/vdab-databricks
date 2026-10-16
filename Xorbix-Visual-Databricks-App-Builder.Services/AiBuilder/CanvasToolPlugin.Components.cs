using System.ComponentModel;
using Microsoft.SemanticKernel;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

internal sealed partial class CanvasToolPlugin
{
    [KernelFunction]
    [Description("Add a label component to the canvas.")]
    public string AddLabel(
        [Description("The display text shown on the label")] string text = "Label Text",
        [Description("Code name in camelCase")] string codeName = "label",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Font size: small, medium, or large")] string fontSize = "medium",
        [Description("Whether the text is bold")] bool bold = false)
    {
        string propsJson = BuildProps(new { text, fontSize, bold });
        return AddComponent(ComponentType.Label, "label", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a text input component to the canvas.")]
    public string AddTextInput(
        [Description("Label shown above the input")] string label = "Text Input",
        [Description("Placeholder text inside the input")] string placeholder = "",
        [Description("Code name in camelCase")] string codeName = "textInput",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0)
    {
        string propsJson = BuildProps(new { label, placeholder });
        return AddComponent(ComponentType.TextInput, "textInput", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a button component to the canvas.")]
    public string AddButton(
        [Description("Button label text")] string label = "Button",
        [Description("Code name in camelCase")] string codeName = "button",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Variant: primary (default, filled with theme color) or secondary (outlined)")] string variant = "primary")
    {
        string propsJson = BuildProps(new { label, variant });
        return AddComponent(ComponentType.Button, "button", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a checkbox component to the canvas.")]
    public string AddCheckbox(
        [Description("Label shown next to the checkbox")] string label = "Checkbox",
        [Description("Code name in camelCase")] string codeName = "checkbox",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Whether the checkbox is checked by default")] bool defaultChecked = false)
    {
        string propsJson = BuildProps(new { label, defaultChecked });
        return AddComponent(ComponentType.Checkbox, "checkbox", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a toggle (on/off switch) component to the canvas.")]
    public string AddToggle(
        [Description("Label shown next to the toggle")] string label = "Toggle",
        [Description("Code name in camelCase")] string codeName = "toggle",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Whether the toggle is on by default")] bool defaultValue = false)
    {
        string propsJson = BuildProps(new { label, defaultValue });
        return AddComponent(ComponentType.Toggle, "toggle", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a dropdown (select) component to the canvas.")]
    public string AddDropdown(
        [Description("Label shown above the dropdown")] string label = "Dropdown",
        [Description("Comma-separated list of option values, e.g. 'Option 1,Option 2,Option 3'")] string options = "Option 1,Option 2",
        [Description("Code name in camelCase")] string codeName = "dropdown",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Placeholder text when nothing is selected")] string placeholder = "",
        [Description("Allow selecting multiple options")] bool multiselect = false)
    {
        List<object> optionsList = options
            .Split(',')
            .Select(o => o.Trim())
            .Where(o => !string.IsNullOrEmpty(o))
            .Select(o => (object)new { value = o })
            .ToList();
        string propsJson = BuildProps(new { label, options = optionsList, placeholder, multiselect });
        return AddComponent(ComponentType.Dropdown, "dropdown", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a date picker component to the canvas.")]
    public string AddDatePicker(
        [Description("Label shown above the date picker")] string label = "Date",
        [Description("Code name in camelCase")] string codeName = "datePicker",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Whether a value is required")] bool required = false)
    {
        string propsJson = BuildProps(new { label, required });
        return AddComponent(ComponentType.DatePicker, "datePicker", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a time picker component to the canvas.")]
    public string AddTimePicker(
        [Description("Label shown above the time picker")] string label = "Time",
        [Description("Code name in camelCase")] string codeName = "timePicker",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Whether a value is required")] bool required = false)
    {
        string propsJson = BuildProps(new { label, required });
        return AddComponent(ComponentType.TimePicker, "timePicker", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a slider component to the canvas.")]
    public string AddSlider(
        [Description("Label shown above the slider")] string label = "Slider",
        [Description("Code name in camelCase")] string codeName = "slider",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Minimum value")] double minValue = 0,
        [Description("Maximum value")] double maxValue = 100,
        [Description("Default starting value")] double defaultValue = 50,
        [Description("Step increment")] double step = 1)
    {
        string propsJson = BuildProps(new { label, minValue, maxValue, defaultValue, step, ranged = false });
        return AddComponent(ComponentType.Slider, "slider", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a form layout container to the canvas. Add child inputs inside it with their parentId set to this form's returned id.")]
    public string AddForm(
        [Description("Text on the submit button")] string submitButtonText = "Submit",
        [Description("Code name in camelCase")] string codeName = "form",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0)
    {
        string propsJson = BuildProps(new { submitButtonText });
        return AddComponent(ComponentType.Form, "form", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a tabs layout container. Children added with a matching tabIndex will appear in the corresponding tab.")]
    public string AddTabs(
        [Description("Comma-separated tab names, e.g. 'Overview,Details,Settings'")] string tabNames = "Tab 1,Tab 2",
        [Description("Code name in camelCase")] string codeName = "tabs",
        [Description("Optional parent id")] string? parentId = null)
    {
        List<string> tabs = tabNames
            .Split(',')
            .Select(t => t.Trim())
            .Where(t => !string.IsNullOrEmpty(t))
            .ToList();
        string propsJson = BuildProps(new { tabs });
        return AddComponent(ComponentType.Tabs, "tabs", codeName, parentId, 0, propsJson);
    }

    [KernelFunction]
    [Description("Add an expander (collapsible section) layout container.")]
    public string AddExpander(
        [Description("Title shown in the expander header")] string sectionTitle = "Section",
        [Description("Code name in camelCase")] string codeName = "expander",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Whether the expander is open by default")] bool defaultExpanded = false)
    {
        string propsJson = BuildProps(new { sectionTitle, defaultExpanded });
        return AddComponent(ComponentType.Expander, "expander", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a modal dialog container.")]
    public string AddModal(
        [Description("Title shown in the modal header")] string title = "Modal Title",
        [Description("Code name in camelCase")] string codeName = "modal",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0)
    {
        string propsJson = BuildProps(new { title });
        return AddComponent(ComponentType.Modal, "modal", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a columns layout container to the canvas.")]
    public string AddColumns(
        [Description("Code name in camelCase")] string codeName = "columns",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Number of columns (leave null for auto)")] int? columnCount = null)
    {
        string propsJson = BuildProps(new { columnCount });
        return AddComponent(ComponentType.Columns, "columns", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a rows layout container to the canvas.")]
    public string AddRows(
        [Description("Code name in camelCase")] string codeName = "rows",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Number of rows (leave null for auto)")] int? rowCount = null)
    {
        string propsJson = BuildProps(new { rowCount });
        return AddComponent(ComponentType.Rows, "rows", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a read-only data window (table) to the canvas.")]
    public string AddDataWindow(
        [Description("Label shown above the table")] string? label = null,
        [Description("Code name in camelCase")] string codeName = "dataWindow",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Maximum number of rows to display")] int maxRows = 5,
        [Description("Whether the table is scrollable")] bool scrollable = true,
        [Description("Placeholder text when no data is bound")] string? placeholder = null)
    {
        string propsJson = BuildProps(new { label, maxRows, scrollable, placeholder });
        return AddComponent(ComponentType.DataWindow, "dataWindow", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add an editable data window (table) to the canvas.")]
    public string AddEditableDataWindow(
        [Description("Label shown above the table")] string? label = null,
        [Description("Code name in camelCase")] string codeName = "editableDataWindow",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Maximum number of rows to display")] int maxRows = 5,
        [Description("Whether the table is scrollable")] bool scrollable = true,
        [Description("Whether editing is disabled")] bool disabled = false)
    {
        string propsJson = BuildProps(new { label, maxRows, scrollable, disabled });
        return AddComponent(ComponentType.EditableDataWindow, "editableDataWindow", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a file upload component to the canvas.")]
    public string AddFileUpload(
        [Description("Label shown above the file upload")] string? label = null,
        [Description("Code name in camelCase")] string codeName = "fileUpload",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0)
    {
        string propsJson = BuildProps(new { label });
        return AddComponent(ComponentType.FileUpload, "fileUpload", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a bar chart visualization to the canvas.")]
    public string AddBarChart(
        [Description("Chart title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "barChart",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Hex color for the series bars, e.g. #4f46e5")] string? seriesColor = null)
    {
        string propsJson = BuildProps(new { title, seriesColor });
        return AddComponent(ComponentType.BarChart, "barChart", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a line chart visualization to the canvas.")]
    public string AddLineChart(
        [Description("Chart title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "lineChart",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Hex color for the series line, e.g. #4f46e5")] string? seriesColor = null)
    {
        string propsJson = BuildProps(new { title, seriesColor });
        return AddComponent(ComponentType.LineChart, "lineChart", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a pie chart visualization to the canvas.")]
    public string AddPieChart(
        [Description("Chart title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "pieChart",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Hex color for slices, e.g. #4f46e5")] string? seriesColor = null)
    {
        string propsJson = BuildProps(new { title, seriesColor });
        return AddComponent(ComponentType.PieChart, "pieChart", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a donut chart visualization to the canvas.")]
    public string AddDonutChart(
        [Description("Chart title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "donutChart",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Hex color for slices, e.g. #4f46e5")] string? seriesColor = null)
    {
        string propsJson = BuildProps(new { title, seriesColor });
        return AddComponent(ComponentType.DonutChart, "donutChart", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Embed a Databricks dashboard using an iframe.")]
    public string AddDashboardEmbed(
        [Description("HTTPS embed URL of the Databricks dashboard")] string src = "",
        [Description("Code name in camelCase")] string codeName = "dashboardEmbed",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Iframe height in pixels")] int height = 600)
    {
        string propsJson = BuildProps(new { src, height });
        return AddComponent(ComponentType.DashboardEmbed, "dashboardEmbed", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Genie Chat AI assistant component to the canvas.")]
    public string AddGenieChat(
        [Description("The Genie Space app resource name")] string genieSpaceAppResourceName = "",
        [Description("Code name in camelCase")] string codeName = "genieChat",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Display title for the chat panel")] string title = "Genie Chat",
        [Description("Total height of the chat panel in pixels")] int chatTotalHeightPixels = ComponentHeightBounds.DefaultPixels,
        [Description("Whether to show a border around the chat panel")] bool showBorder = false)
    {
        string propsJson = BuildProps(new { genieSpaceAppResourceName, title, chatTotalHeightPixels, showBorder });
        return AddComponent(ComponentType.GenieChat, "genieChat", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Model Chat component backed by a Databricks Model Serving endpoint app resource.")]
    public string AddModelChat(
        [Description("The Serving endpoint app resource name")] string servingEndpointAppResourceName = "",
        [Description("Code name in camelCase")] string codeName = "modelChat",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Display title for the chat panel")] string title = "Model Chat",
        [Description("Total height of the chat panel in pixels")] int chatTotalHeightPixels = ComponentHeightBounds.DefaultPixels,
        [Description("Whether to show a border around the chat panel")] bool showBorder = false)
    {
        string propsJson = BuildProps(new
        {
            servingEndpointAppResourceName,
            title,
            chatTotalHeightPixels,
            showBorder,
        });
        return AddComponent(ComponentType.ModelChat, "modelChat", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a child component inside a container using raw propsJson. FALLBACK ONLY — all standard component types have dedicated addXxx functions with a parentId parameter; use those instead.")]
    public string AddChildComponent(
        [Description("Component type name, e.g. TextInput, Button, Dropdown")] string componentType,
        [Description("Existing parent component id or codeName")] string parentIdOrCodeName,
        [Description("Optional child codeName in camelCase")] string? codeName = null,
        [Description("Optional tab index (used for Tabs parent)")] int tabIndex = 0,
        [Description("Optional props JSON matching the selected component's Props shape")] string propsJson = "{}")
    {
        if (!Enum.TryParse(componentType, ignoreCase: true, out ComponentType parsedType))
            throw new InvalidOperationException($"Unknown component type '{componentType}'.");

        ValidatePropsJsonForRequiredFields(parsedType, propsJson);

        string resolvedParentId = ResolveRequiredParentId(parentIdOrCodeName);
        string defaultCodeName = char.ToLowerInvariant(parsedType.ToString()[0]) + parsedType.ToString()[1..];
        return AddComponent(parsedType, defaultCodeName, codeName ?? defaultCodeName, resolvedParentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Modify an existing component on the canvas. Identify it by componentId or codeName.")]
    public string ModifyComponent(
        [Description("Existing component id to modify")] string componentId = "",
        [Description("Existing component codeName to modify (used if componentId is empty)")] string codeName = "",
        [Description("Optional new code name in camelCase")] string? newCodeName = null,
        [Description("Optional replacement props JSON matching the component's Props shape")] string propsJson = "{}",
        [Description("Optional new parent id")] string? parentId = null,
        [Description("Optional child index for placement")] int? childIndex = null,
        [Description("Optional tab index")] int? tabIndex = null)
    {
        string targetId = ResolveComponentId(componentId, codeName);
        if (!_componentTypeById.TryGetValue(targetId, out ComponentType componentType))
            throw new InvalidOperationException($"Cannot modify component '{targetId}'. Type is unknown in current canvas.");

        string? resolvedCodeName = newCodeName;
        if (string.IsNullOrWhiteSpace(resolvedCodeName))
        {
            resolvedCodeName = _componentIdByCodeName
                .FirstOrDefault(pair => pair.Value.Equals(targetId, StringComparison.OrdinalIgnoreCase))
                .Key;
        }

        if (string.IsNullOrWhiteSpace(resolvedCodeName))
            resolvedCodeName = componentType.ToString();

        if (_componentIdByCodeName.TryGetValue(resolvedCodeName, out string? existingId)
            && !existingId.Equals(targetId, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Component codeName '{resolvedCodeName}' already exists. Choose a unique codeName.");
        }

        if (string.IsNullOrWhiteSpace(propsJson))
            propsJson = "{}";

        ValidatePropsJsonForRequiredFields(componentType, propsJson);

        VdabComponentDto? component = CreateComponent(componentType, targetId, resolvedCodeName, propsJson);
        if (component is null)
            throw new InvalidOperationException($"Unsupported component type for modify: {componentType}");

        _operations.Add(new CanvasOperationDto
        {
            Op = "modify",
            ComponentId = targetId,
            Component = component,
            ParentId = parentId,
            ChildIndex = childIndex,
            TabIndex = tabIndex,
        });

        KeyValuePair<string, string> oldCodeNameMatch = _componentIdByCodeName
            .FirstOrDefault(pair => pair.Value.Equals(targetId, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(oldCodeNameMatch.Key)
            && !oldCodeNameMatch.Key.Equals(resolvedCodeName, StringComparison.OrdinalIgnoreCase))
        {
            _componentIdByCodeName.Remove(oldCodeNameMatch.Key);
        }

        _componentIdByCodeName[resolvedCodeName] = targetId;
        return targetId;
    }

    [KernelFunction]
    [Description("Delete an existing component from the canvas. Identify it by componentId or codeName.")]
    public string DeleteComponent(
        [Description("Existing component id to delete")] string componentId = "",
        [Description("Existing component codeName to delete (used if componentId is empty)")] string codeName = "")
    {
        string targetId = ResolveComponentId(componentId, codeName);

        _operations.Add(new CanvasOperationDto { Op = "delete", ComponentId = targetId });

        KeyValuePair<string, string> match = _componentIdByCodeName
            .FirstOrDefault(pair => pair.Value.Equals(targetId, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(match.Key))
            _componentIdByCodeName.Remove(match.Key);

        _componentTypeById.Remove(targetId);
        return targetId;
    }
}
