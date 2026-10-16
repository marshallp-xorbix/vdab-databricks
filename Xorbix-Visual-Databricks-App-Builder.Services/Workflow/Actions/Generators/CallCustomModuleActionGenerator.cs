using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;

public class CallCustomModuleActionGenerator : WorkflowActionGeneratorBase<CallCustomModuleActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.CallCustomModule;

    public override void AppendRuntimeExecution(
        StringBuilder sb,
        CallCustomModuleActionModel actionNode,
        WorkflowActionGenerationContext generationContext,
        VdabComponentDto? triggerComponent,
        List<VdabComponentDto> components,
        string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);
        string functionLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(actionNode.FunctionName.Trim());

        sb.AppendLine($"{indentation}try:");
        sb.AppendLine($"{indentation}    _ctx = _create_vdab_custom_context(workflow_state)");
        sb.AppendLine($"{indentation}    _custom_out = _invoke_custom_module({functionLiteral}, _ctx)");
        sb.AppendLine(
            $"{indentation}    workflow_state['{nodeId}'] = {{'status': 'success', 'output': _custom_out, 'error': None}}");
        sb.AppendLine($"{indentation}except Exception as _custom_ex:");
        sb.AppendLine(
            $"{indentation}    workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': str(_custom_ex)}}");
    }
}
