using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

/// <summary>
/// Typed StartDatabricksJob workflow node model.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/actions/startDatabricksJob.ts
/// </summary>
public sealed class StartDatabricksJobActionModel : WorkflowActionNodeModel
{
    public required DatabricksJobResourceRef Job { get; init; }

    public override WorkflowActionKind ActionType => WorkflowActionKind.StartDatabricksJob;
}