using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

/// <summary>
/// Invokes a top-level function from <c>custom_modules.py</c> with a generated VDAB context.
/// </summary>
public sealed class CallCustomModuleActionModel : WorkflowActionNodeModel
{
    /// <summary>
    /// Name of the callable on the <c>custom_modules</c> module (public identifier only).
    /// </summary>
    public required string FunctionName { get; init; }

    public override WorkflowActionKind ActionType => WorkflowActionKind.CallCustomModule;
}
