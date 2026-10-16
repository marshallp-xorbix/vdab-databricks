using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed class ShowModalActionDefinition : WorkflowActionDefinitionBase<ShowModalActionModel>
{
    public ShowModalActionDefinition()
        : base(WorkflowActionKind.ShowModal)
    {
    }

    protected override Result ValidateTyped(ShowModalActionModel actionNode, WorkflowActionValidationContext context)
    {
        if (string.IsNullOrWhiteSpace(actionNode.ModalCodeName))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a modal target."));
        }

        if (!context.ComponentsByCodeName.TryGetValue(actionNode.ModalCodeName, out VdabComponentDto? modalComponent) ||
            modalComponent.Type != ComponentType.Modal)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' references missing modal '{actionNode.ModalCodeName}'."));
        }

        return Result.Ok();
    }
}