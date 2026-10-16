using System.Text;
using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
public class CallPrebuiltModuleActionGenerator : WorkflowActionGeneratorBase<CallPrebuiltModuleActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.CallPrebuiltModule;

    public override void AppendRuntimeExecution(
        StringBuilder sb,
        CallPrebuiltModuleActionModel actionNode,
        WorkflowActionGenerationContext generationContext,
        VdabComponentDto? triggerComponent,
        List<VdabComponentDto> components,
        string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);
        string functionName = actionNode.FunctionName.Trim();

        Result<List<string>> parametersResult = PrebuiltModulesPythonParser.TryGetWorkflowParameterNames(
            PrebuiltModulesLibrary.GetContent(),
            functionName);
        if (parametersResult.IsFailed)
        {
            throw new InvalidOperationException(parametersResult.Errors.FirstOrDefault()?.Message ?? "Prebuilt module parameter metadata is unavailable.");
        }

        List<string> parameterOrder = parametersResult.Value;
        StringBuilder callArgs = new StringBuilder();
        foreach (string parameterName in parameterOrder)
        {
            actionNode.NamedArguments.TryGetValue(parameterName, out string? rawValue);
            string value = rawValue ?? string.Empty;
            callArgs.Append(", ");
            callArgs.Append(WorkflowTemplateHelper.BuildPythonStringLiteral(value));
        }

        sb.AppendLine($"{indentation}try:");
        sb.AppendLine($"{indentation}    _ctx = _create_vdab_custom_context(workflow_state)");
        sb.AppendLine(
            $"{indentation}    _prebuilt_out = _normalize_custom_module_result({functionName}(_ctx{callArgs}))");
        sb.AppendLine(
            $"{indentation}    workflow_state['{nodeId}'] = {{'status': 'success', 'output': _prebuilt_out, 'error': None}}");
        sb.AppendLine($"{indentation}except Exception as _prebuilt_ex:");
        sb.AppendLine(
            $"{indentation}    workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': str(_prebuilt_ex)}}");
    }
}
