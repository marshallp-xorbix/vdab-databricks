using System.Text.Json.Serialization;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

/// <summary>
/// Typed SetBinding workflow node model.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/actions/setBinding.ts
/// </summary>
public sealed class SetBindingActionModel : WorkflowActionNodeModel
{
    public required SetBindingSourceRef Source { get; init; }

    public required SetBindingTargetRef Target { get; init; }

    public override WorkflowActionKind ActionType => WorkflowActionKind.SetBinding;
}

public sealed class SetBindingSourceRef
{
    public required SetBindingSourceActionType SourceActionType { get; init; }

    public required string NodeId { get; init; }

    public required SetBindingOutputKey OutputKey { get; init; }
}

public sealed class SetBindingTargetRef
{
    public required string ComponentCodeName { get; init; }

    public required SetBindingTargetType BindingType { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SetBindingSourceActionType
{
    [JsonStringEnumMemberName("RunSql")]
    RunSql
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SetBindingOutputKey
{
    [JsonStringEnumMemberName("rows")]
    Rows
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SetBindingTargetType
{
    [JsonStringEnumMemberName("unityCatalogTable")]
    UnityCatalogTable,

    [JsonStringEnumMemberName("chartData")]
    ChartData
}