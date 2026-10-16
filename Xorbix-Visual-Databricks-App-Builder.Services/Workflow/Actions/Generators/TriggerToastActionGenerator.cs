using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;

public class TriggerToastActionGenerator : WorkflowActionGeneratorBase<TriggerToastActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.TriggerToast;

    public override void AppendRuntimeExecution(StringBuilder sb, TriggerToastActionModel actionNode, WorkflowActionGenerationContext generationContext, VdabComponentDto? triggerComponent, List<VdabComponentDto> components, string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);

        string toastBody = WorkflowTemplateHelper.BuildPythonStringLiteral(actionNode.Body);
        string iconArg = BuildIconArgument(actionNode.Icon);
        string durationArg = BuildDurationArgument(actionNode);

        sb.AppendLine($"{indentation}_vdab_enqueue_toast({toastBody}{iconArg}{durationArg})");
        sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'success', 'output': {{'shown': True}}, 'error': None}}");
    }

    private static string BuildIconArgument(string? icon)
    {
        return string.IsNullOrWhiteSpace(icon)
            ? string.Empty
            : $", icon={WorkflowTemplateHelper.BuildPythonStringLiteral(icon)}";
    }

    private static string BuildDurationArgument(TriggerToastActionModel actionNode)
    {
        return actionNode.Duration switch
        {
            ToastSecondsDurationModel secondsDuration => $", duration={secondsDuration.Value}",
            ToastPresetDurationModel presetDuration => $", duration={WorkflowTemplateHelper.BuildPythonStringLiteral(WorkflowTemplateHelper.GetToastPresetDurationValue(presetDuration.Value))}",
            _ => throw new InvalidOperationException($"Workflow toast node '{actionNode.Id}' has an unsupported typed duration model '{actionNode.Duration.GetType().Name}'."),
        };
    }
}
