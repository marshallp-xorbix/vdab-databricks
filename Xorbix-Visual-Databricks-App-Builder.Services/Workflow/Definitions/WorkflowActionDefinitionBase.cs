using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal abstract class WorkflowActionDefinitionBase<TActionModel> : IWorkflowActionDefinition
    where TActionModel : WorkflowActionNodeModel
{
    protected WorkflowActionDefinitionBase(WorkflowActionKind actionKind)
    {
        ActionKind = actionKind;
    }

    public WorkflowActionKind ActionKind { get; }

    public Type ActionModelType => typeof(TActionModel);

    public Result Validate(WorkflowActionNodeModel actionNode, WorkflowActionValidationContext context)
    {
        if (actionNode is not TActionModel typedActionNode)
        {
            return Result.Fail(new ValidationError($"Workflow action definition '{ActionKind}' expected action model '{typeof(TActionModel).Name}' but received '{actionNode.GetType().Name}'."));
        }

        return ValidateTyped(typedActionNode, context);
    }

    protected abstract Result ValidateTyped(TActionModel actionNode, WorkflowActionValidationContext context);
}