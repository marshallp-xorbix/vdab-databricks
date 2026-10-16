using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed class SetBindingActionDefinition : WorkflowActionDefinitionBase<SetBindingActionModel>
{
    public SetBindingActionDefinition()
        : base(WorkflowActionKind.SetBinding)
    {
    }

    protected override Result ValidateTyped(SetBindingActionModel actionNode, WorkflowActionValidationContext context)
    {
        if (actionNode.Source == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a SetBinding source reference."));
        }

        if (actionNode.Source.SourceActionType != SetBindingSourceActionType.RunSql)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires source.sourceActionType to be RunSql."));
        }

        if (actionNode.Source.OutputKey != SetBindingOutputKey.Rows)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires source.outputKey to be rows."));
        }

        if (string.IsNullOrWhiteSpace(actionNode.Source.NodeId))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a source RunSql node."));
        }

        if (actionNode.Target == null || string.IsNullOrWhiteSpace(actionNode.Target.ComponentCodeName))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a SetBinding target component."));
        }

        if (!context.ComponentsByCodeName.TryGetValue(actionNode.Target.ComponentCodeName, out VdabComponentDto? targetComponent))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' references missing target component '{actionNode.Target.ComponentCodeName}'."));
        }

        SetBindingTargetType? inferredBindingType = SetBindingTargetResolver.GetTargetType(targetComponent);
        if (inferredBindingType == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' target component '{actionNode.Target.ComponentCodeName}' does not support workflow SQL-statement bindings."));
        }

        if (actionNode.Target.BindingType != inferredBindingType.Value)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' target component '{actionNode.Target.ComponentCodeName}' requires binding type '{inferredBindingType.Value}'."));
        }

        return Result.Ok();
    }
}