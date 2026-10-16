using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;

public class ShowModalActionGenerator : WorkflowActionGeneratorBase<ShowModalActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.ShowModal;

    public override void AppendRuntimeExecution(StringBuilder sb, ShowModalActionModel actionNode, WorkflowActionGenerationContext generationContext, VdabComponentDto? triggerComponent, List<VdabComponentDto> components, string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);
        string modalFunctionName = BuildModalFunctionName(actionNode);

        sb.AppendLine($"{indentation}{modalFunctionName}()");
        sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'success', 'output': {{'visible': True}}, 'error': None}}");
    }

    private static string BuildModalFunctionName(ShowModalActionModel actionNode)
    {
        if (string.IsNullOrWhiteSpace(actionNode.ModalCodeName))
        {
            throw new InvalidOperationException($"Workflow modal node '{actionNode.Id}' is missing a validated modal code name.");
        }

        return $"show_{actionNode.ModalCodeName}";
    }
}
