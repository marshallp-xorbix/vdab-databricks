using Microsoft.SemanticKernel;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Emits user-visible progress labels when AI Builder kernel tools run.
/// </summary>
internal sealed class AiBuilderToolProgressFilter : IFunctionInvocationFilter
{
    private static readonly Dictionary<string, string> ToolLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["AddLabel"] = "Adding label",
        ["AddTextInput"] = "Adding text input",
        ["AddButton"] = "Adding button",
        ["AddCheckbox"] = "Adding checkbox",
        ["AddToggle"] = "Adding toggle",
        ["AddDropdown"] = "Adding dropdown",
        ["AddDatePicker"] = "Adding date picker",
        ["AddTimePicker"] = "Adding time picker",
        ["AddSlider"] = "Adding slider",
        ["AddForm"] = "Adding form",
        ["AddTabs"] = "Adding tabs",
        ["AddExpander"] = "Adding expander",
        ["AddModal"] = "Adding modal",
        ["AddColumns"] = "Adding columns layout",
        ["AddRows"] = "Adding rows layout",
        ["AddDataWindow"] = "Adding data table",
        ["AddEditableDataWindow"] = "Adding editable data table",
        ["AddFileUpload"] = "Adding file upload",
        ["AddBarChart"] = "Adding bar chart",
        ["AddLineChart"] = "Adding line chart",
        ["AddPieChart"] = "Adding pie chart",
        ["AddDonutChart"] = "Adding donut chart",
        ["AddAmoebaStory"] = "Adding amoeba story",
        ["AddNetworkWebStory"] = "Adding network web story",
        ["AddTerrainStory"] = "Adding terrain story",
        ["AddHeatMapStory"] = "Adding heat map story",
        ["AddPulseWaveStory"] = "Adding pulse wave story",
        ["AddFlowFieldStory"] = "Adding flow field story",
        ["AddHoneycombStory"] = "Adding honeycomb story",
        ["AddSpiralStory"] = "Adding spiral story",
        ["AddDashboardEmbed"] = "Embedding dashboard",
        ["AddGenieChat"] = "Adding Genie Chat",
        ["AddModelChat"] = "Adding Model Chat",
        ["AddChildComponent"] = "Adding component",
        ["ModifyComponent"] = "Updating component",
        ["DeleteComponent"] = "Removing component",
        ["CreateWorkflow"] = "Creating workflow",
        ["AddTriggerToastAction"] = "Adding toast action",
        ["AddShowModalAction"] = "Adding show-modal action",
        ["AddBuildSqlAction"] = "Adding SQL query action",
        ["AddRunSqlAction"] = "Adding run SQL action",
        ["AddSetBindingAction"] = "Adding set binding action",
        ["ConnectWorkflowNodes"] = "Connecting workflow nodes",
        ["DeleteWorkflow"] = "Removing workflow",
        ["AddSaveToTableAction"] = "Adding save-to-table action",
        ["AddSaveToLakebaseProvisionedAction"] = "Adding Lakebase save-to-table action",
        ["AddSaveToLakebaseAutoscalingAction"] = "Adding Lakebase autoscaling save-to-table action",
        ["AddStartDatabricksJobAction"] = "Adding start-job action",
        ["AddCallCustomModuleAction"] = "Adding custom module action",
        ["AddCallPrebuiltModuleAction"] = "Adding prebuilt module action",
        ["UpdateCustomModulesCode"] = "Updating custom modules",
        ["SetStaticVolumeBinding"] = "Binding Databricks Volume",
        ["SetStaticUnityCatalogBinding"] = "Binding table data",
        ["SetStaticLakebaseProvisionedBinding"] = "Binding Lakebase data",
        ["SetStaticLakebaseAutoscalingBinding"] = "Binding Lakebase autoscaling data",
    };

    private readonly Action<string> _onProgress;

    public AiBuilderToolProgressFilter(Action<string> onProgress) => _onProgress = onProgress;

    public async Task OnFunctionInvocationAsync(FunctionInvocationContext context, Func<FunctionInvocationContext, Task> next)
    {
        string label = ToolLabels.TryGetValue(context.Function.Name, out string? mapped) ? mapped : context.Function.Name;

        if (context.Arguments.TryGetValue("codeName", out object? codeNameArg)
            && codeNameArg is string codeName
            && !string.IsNullOrWhiteSpace(codeName))
        {
            label += $" \"{codeName}\"";
        }
        else if (context.Arguments.TryGetValue("label", out object? labelArg)
            && labelArg is string lbl
            && !string.IsNullOrWhiteSpace(lbl))
        {
            label += $" \"{lbl}\"";
        }

        _onProgress($"{label}...");
        await next(context);
    }
}
