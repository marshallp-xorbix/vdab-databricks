using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

/// <summary>
/// Typed ShowModal workflow node model.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/actions/showModal.ts
/// </summary>
public sealed class ShowModalActionModel : WorkflowActionNodeModel
{
    public required string ModalCodeName { get; init; }

    public override WorkflowActionKind ActionType => WorkflowActionKind.ShowModal;
}