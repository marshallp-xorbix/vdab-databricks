using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed class CallCustomModuleActionDefinition : WorkflowActionDefinitionBase<CallCustomModuleActionModel>
{
    public CallCustomModuleActionDefinition()
        : base(WorkflowActionKind.CallCustomModule)
    {
    }

    protected override Result ValidateTyped(CallCustomModuleActionModel actionNode, WorkflowActionValidationContext context)
    {
        if (!CustomModuleFunctionNameSyntax.IsValid(actionNode.FunctionName))
        {
            return Result.Fail(new ValidationError(
                $"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a valid functionName (public Python identifier, no dunders)."));
        }

        return Result.Ok();
    }
}
