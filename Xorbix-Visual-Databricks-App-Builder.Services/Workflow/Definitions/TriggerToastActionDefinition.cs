using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed class TriggerToastActionDefinition : WorkflowActionDefinitionBase<TriggerToastActionModel>
{
    public TriggerToastActionDefinition()
        : base(WorkflowActionKind.TriggerToast)
    {
    }

    protected override Result ValidateTyped(TriggerToastActionModel actionNode, WorkflowActionValidationContext context)
    {
        if (string.IsNullOrWhiteSpace(actionNode.Body))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a toast body."));
        }

        if (actionNode.Duration == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a toast duration."));
        }

        if (actionNode.Duration is ToastPresetDurationModel presetDuration)
        {
            if (!Enum.IsDefined(presetDuration.Value))
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' has unsupported toast duration preset '{presetDuration.Value}'."));
            }

            return Result.Ok();
        }

        if (actionNode.Duration is ToastSecondsDurationModel secondsDuration)
        {
            if (secondsDuration.Value <= 0)
            {
                return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a positive numeric toast duration in seconds."));
            }

            return Result.Ok();
        }

        return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' has an unsupported toast duration shape."));
    }
}