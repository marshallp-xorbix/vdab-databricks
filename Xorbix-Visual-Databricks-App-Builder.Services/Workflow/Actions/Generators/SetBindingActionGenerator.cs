using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;

public class SetBindingActionGenerator : WorkflowActionGeneratorBase<SetBindingActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.SetBinding;

    public override void AppendRuntimeExecution(StringBuilder sb, SetBindingActionModel actionNode, WorkflowActionGenerationContext generationContext, VdabComponentDto? triggerComponent, List<VdabComponentDto> components, string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);
        if (!generationContext.NodesById.TryGetValue(actionNode.Source.NodeId, out WorkflowActionNodeModel? sourceNode) ||
            sourceNode is not RunSqlActionModel)
        {
            sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': 'SetBinding requires a resolved RunSql source node.'}}");
            return;
        }

        VdabComponentDto? targetComponent = components.FirstOrDefault(component =>
            string.Equals(component.CodeName, actionNode.Target.ComponentCodeName, StringComparison.Ordinal));
        SetBindingTargetType resolvedBindingType = SetBindingTargetResolver.GetTargetType(targetComponent) ?? actionNode.Target.BindingType;
        string bindingType = WorkflowTemplateHelper.EscapePythonString(WorkflowTemplateHelper.GetBindingTypeValue(resolvedBindingType));
        string targetComponentCodeName = WorkflowTemplateHelper.EscapePythonString(actionNode.Target.ComponentCodeName);
        string toastMessageLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral($"Binding was set on component '{actionNode.Target.ComponentCodeName}'. Manually rerun to see updated data.");
        string outputKey = GetOutputKeyValue(actionNode.Source.OutputKey);
        string sourcePath = $"{actionNode.Source.NodeId}.output.{outputKey}";
        sb.AppendLine($"{indentation}binding_value = _resolve_workflow_path({WorkflowTemplateHelper.BuildPythonStringLiteral(sourcePath)}, workflow_state)");
        sb.AppendLine($"{indentation}binding_overrides['{targetComponentCodeName}:{bindingType}'] = binding_value");
        sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'success', 'output': {{'applied': binding_value is not None}}, 'error': None}}");
        sb.AppendLine($"{indentation}st.toast({toastMessageLiteral}, icon=':material/info:')");
    }

    private static string GetOutputKeyValue(SetBindingOutputKey outputKey)
    {
        return outputKey switch
        {
            SetBindingOutputKey.Rows => "rows",
            _ => throw new InvalidOperationException($"Unsupported SetBinding outputKey '{outputKey}'.")
        };
    }
}
