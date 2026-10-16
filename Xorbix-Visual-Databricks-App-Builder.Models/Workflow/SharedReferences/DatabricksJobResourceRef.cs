namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;

/// <summary>
/// Structured Databricks job reference for workflow actions.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/sharedReferences.ts
/// </summary>
public class DatabricksJobResourceRef
{
    public string ResourceType { get; init; } = "databricksJob";

    public required int WorkspaceConnectionId { get; init; }

    public required string JobId { get; init; }

    public required string JobName { get; init; }
}