using System.Text.Json.Serialization;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

/// <summary>
/// Typed RunSql workflow node model.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/actions/runSql.ts
/// </summary>
public sealed class RunSqlActionModel : WorkflowActionNodeModel
{
    public required RunSqlStatementRef Statement { get; init; }

    public override WorkflowActionKind ActionType => WorkflowActionKind.RunSql;
}

public sealed class RunSqlStatementRef
{
    public required RunSqlStatementSourceActionType SourceActionType { get; init; }

    public required string NodeId { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RunSqlStatementSourceActionType
{
    [JsonStringEnumMemberName("BuildSql")]
    BuildSql
}