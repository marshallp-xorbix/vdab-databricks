using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed class CallPrebuiltModuleActionDefinition : WorkflowActionDefinitionBase<CallPrebuiltModuleActionModel>
{
    public CallPrebuiltModuleActionDefinition()
        : base(WorkflowActionKind.CallPrebuiltModule)
    {
    }

    protected override Result ValidateTyped(CallPrebuiltModuleActionModel actionNode, WorkflowActionValidationContext context)
    {
        if (!CustomModuleFunctionNameSyntax.IsValid(actionNode.FunctionName))
        {
            return Result.Fail(new ValidationError(
                $"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a valid functionName (public Python identifier, no dunders)."));
        }

        string librarySource = PrebuiltModulesLibrary.GetContent();
        Result<List<string>> parametersResult = PrebuiltModulesPythonParser.TryGetWorkflowParameterNames(
            librarySource,
            actionNode.FunctionName);
        if (parametersResult.IsFailed)
        {
            return Result.Fail(parametersResult.Errors);
        }

        List<string> expectedParameters = parametersResult.Value;
        HashSet<string> expectedSet = new(expectedParameters, StringComparer.Ordinal);
        foreach (KeyValuePair<string, string> pair in actionNode.NamedArguments)
        {
            if (!expectedSet.Contains(pair.Key))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' has unknown prebuilt argument '{pair.Key}' for function '{actionNode.FunctionName}'."));
            }
        }

        foreach (string parameterName in expectedParameters)
        {
            if (!actionNode.NamedArguments.ContainsKey(parameterName))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' is missing required prebuilt argument '{parameterName}' for function '{actionNode.FunctionName}'."));
            }
        }

        return Result.Ok();
    }
}
