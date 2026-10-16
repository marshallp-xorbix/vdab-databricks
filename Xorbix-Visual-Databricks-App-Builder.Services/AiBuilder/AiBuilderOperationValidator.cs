using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

internal static class AiBuilderOperationValidator
{
    private static readonly HashSet<string> _allowedOperations = new(StringComparer.OrdinalIgnoreCase)
    {
        "add",
        "delete",
        "modify",
        "setBindings",
        "addWorkflow",
        "deleteWorkflow",
        "updateCustomModulesCode",
    };

    private static readonly HashSet<string> _allowedRoutes = new(StringComparer.OrdinalIgnoreCase)
    {
        "onSuccess",
        "onError",
        "always",
    };

    internal static AiBuilderOutcomeReason? Validate(AiBuilderRequest request, IReadOnlyList<CanvasOperationDto> operations)
    {
        Dictionary<string, string> componentCodeNameById = request.CurrentComponents
            .Where(component => !string.IsNullOrWhiteSpace(component.Id))
            .GroupBy(component => component.Id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().CodeName, StringComparer.OrdinalIgnoreCase);

        HashSet<string> componentCodeNames = request.CurrentComponents
            .Select(component => component.CodeName)
            .Where(codeName => !string.IsNullOrWhiteSpace(codeName))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        HashSet<string> workflowCodeNames = request.CurrentWorkflows
            .Select(workflow => workflow.CodeName)
            .Where(codeName => !string.IsNullOrWhiteSpace(codeName))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        Dictionary<string, string> workflowTriggerKeyByCodeName = request.CurrentWorkflows
            .Where(workflow => !string.IsNullOrWhiteSpace(workflow.CodeName))
            .ToDictionary(
                workflow => workflow.CodeName,
                workflow => AiBuilderWorkflowKeys.BuildTriggerKey(workflow.TriggerComponentCodeName, workflow.TriggerEventKey),
                StringComparer.OrdinalIgnoreCase);

        HashSet<string> workflowTriggerKeys = workflowTriggerKeyByCodeName.Values
            .Where(triggerKey => !string.IsNullOrWhiteSpace(triggerKey))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        string customModulesCode = CustomModulesTemplate.ResolveContent(request.CustomModulesCode);
        Dictionary<string, AiBuilderModuleFunction> customFunctionsByName = AiBuilderModuleFunctionParser
            .ParseCallableCustomFunctions(customModulesCode)
            .ToDictionary(function => function.FunctionName, StringComparer.Ordinal);
        Dictionary<string, AiBuilderModuleFunction> prebuiltFunctionsByName = AiBuilderModuleFunctionParser
            .ParsePrebuiltFunctions(PrebuiltModulesLibrary.GetContent())
            .ToDictionary(function => function.FunctionName, StringComparer.Ordinal);

        foreach (CanvasOperationDto operation in operations)
        {
            AiBuilderOutcomeReason? operationReason = ValidateOperation(
                operation,
                componentCodeNameById,
                componentCodeNames,
                workflowCodeNames,
                workflowTriggerKeys,
                workflowTriggerKeyByCodeName,
                customFunctionsByName,
                prebuiltFunctionsByName);

            if (operationReason is not null)
            {
                return operationReason;
            }
        }

        return null;
    }

    private static AiBuilderOutcomeReason? ValidateOperation(
        CanvasOperationDto operation,
        Dictionary<string, string> componentCodeNameById,
        HashSet<string> componentCodeNames,
        HashSet<string> workflowCodeNames,
        HashSet<string> workflowTriggerKeys,
        Dictionary<string, string> workflowTriggerKeyByCodeName,
        Dictionary<string, AiBuilderModuleFunction> customFunctionsByName,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> prebuiltFunctionsByName)
    {
        if (!_allowedOperations.Contains(operation.Op))
        {
            return CreateValidationReason($"Unsupported AI operation '{operation.Op}'.");
        }

        return operation.Op switch
        {
            "add" => ValidateAddOperation(operation, componentCodeNameById, componentCodeNames),
            "modify" => ValidateExistingComponentOperation(operation, componentCodeNameById, "modify"),
            "delete" => ValidateDeleteOperation(operation, componentCodeNameById, componentCodeNames),
            "setBindings" => ValidateExistingComponentOperation(operation, componentCodeNameById, "set bindings on"),
            "updateCustomModulesCode" => ValidateUpdateCustomModulesCodeOperation(operation, customFunctionsByName),
            "addWorkflow" => ValidateAddWorkflowOperation(operation, componentCodeNames, workflowCodeNames, workflowTriggerKeys, workflowTriggerKeyByCodeName, customFunctionsByName, prebuiltFunctionsByName),
            "deleteWorkflow" => ValidateDeleteWorkflowOperation(operation, workflowCodeNames, workflowTriggerKeys, workflowTriggerKeyByCodeName),
            _ => null,
        };
    }

    private static AiBuilderOutcomeReason? ValidateAddOperation(
        CanvasOperationDto operation,
        Dictionary<string, string> componentCodeNameById,
        HashSet<string> componentCodeNames)
    {
        if (operation.Component is null)
        {
            return CreateValidationReason("AI returned an add operation without a component.");
        }

        if (string.IsNullOrWhiteSpace(operation.Component.Id) || string.IsNullOrWhiteSpace(operation.Component.CodeName))
        {
            return CreateValidationReason("AI returned a component without both id and codeName.");
        }

        if (componentCodeNameById.ContainsKey(operation.Component.Id))
        {
            return CreateValidationReason($"AI returned duplicate component id '{operation.Component.Id}'.");
        }

        if (componentCodeNames.Contains(operation.Component.CodeName))
        {
            return CreateValidationReason($"AI returned duplicate component codeName '{operation.Component.CodeName}'.");
        }

        if (!string.IsNullOrWhiteSpace(operation.ParentId) && !componentCodeNameById.ContainsKey(operation.ParentId))
        {
            return CreateValidationReason($"AI tried to add component '{operation.Component.CodeName}' under unknown parent '{operation.ParentId}'.");
        }

        componentCodeNameById[operation.Component.Id] = operation.Component.CodeName;
        componentCodeNames.Add(operation.Component.CodeName);
        return null;
    }

    private static AiBuilderOutcomeReason? ValidateExistingComponentOperation(
        CanvasOperationDto operation,
        IReadOnlyDictionary<string, string> componentCodeNameById,
        string verb)
    {
        string? componentId = operation.ComponentId ?? operation.Component?.Id;
        if (string.IsNullOrWhiteSpace(componentId) || !componentCodeNameById.ContainsKey(componentId))
        {
            return CreateValidationReason($"AI tried to {verb} an unknown component '{componentId}'.");
        }

        return null;
    }

    private static AiBuilderOutcomeReason? ValidateDeleteOperation(
        CanvasOperationDto operation,
        Dictionary<string, string> componentCodeNameById,
        HashSet<string> componentCodeNames)
    {
        AiBuilderOutcomeReason? reason = ValidateExistingComponentOperation(operation, componentCodeNameById, "delete");
        if (reason is not null)
        {
            return reason;
        }

        string componentId = operation.ComponentId!;
        componentCodeNames.Remove(componentCodeNameById[componentId]);
        componentCodeNameById.Remove(componentId);
        return null;
    }

    private static AiBuilderOutcomeReason? ValidateUpdateCustomModulesCodeOperation(
        CanvasOperationDto operation,
        Dictionary<string, AiBuilderModuleFunction> customFunctionsByName)
    {
        if (string.IsNullOrWhiteSpace(operation.CustomModulesCode))
        {
            return CreateValidationReason("AI returned updateCustomModulesCode without Python source.");
        }

        List<AiBuilderModuleFunction> callableFunctions = AiBuilderModuleFunctionParser.ParseCallableCustomFunctions(operation.CustomModulesCode);
        if (callableFunctions.Count == 0)
        {
            return CreateValidationReason("AI-written custom_modules.py must define at least one public top-level function whose first parameter is ctx.");
        }

        customFunctionsByName.Clear();
        foreach (AiBuilderModuleFunction function in callableFunctions)
        {
            customFunctionsByName[function.FunctionName] = function;
        }

        return null;
    }

    private static AiBuilderOutcomeReason? ValidateAddWorkflowOperation(
        CanvasOperationDto operation,
        IReadOnlySet<string> componentCodeNames,
        HashSet<string> workflowCodeNames,
        HashSet<string> workflowTriggerKeys,
        Dictionary<string, string> workflowTriggerKeyByCodeName,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> customFunctionsByName,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> prebuiltFunctionsByName)
    {
        if (operation.Workflow is null)
        {
            return CreateValidationReason("AI returned an addWorkflow operation without a workflow.");
        }

        WorkflowDto workflow = operation.Workflow;
        if (string.IsNullOrWhiteSpace(workflow.CodeName))
        {
            return CreateValidationReason("AI returned a workflow without a codeName.");
        }

        if (workflowCodeNames.Contains(workflow.CodeName))
        {
            return CreateValidationReason($"AI returned duplicate workflow codeName '{workflow.CodeName}'.");
        }

        if (!componentCodeNames.Contains(workflow.Trigger.ComponentCodeName))
        {
            return CreateValidationReason($"Workflow '{workflow.CodeName}' uses unknown trigger component '{workflow.Trigger.ComponentCodeName}'.");
        }

        string triggerKey = AiBuilderWorkflowKeys.BuildTriggerKey(workflow.Trigger.ComponentCodeName, workflow.Trigger.EventKey);
        if (workflowTriggerKeys.Contains(triggerKey))
        {
            return CreateValidationReason($"Workflow '{workflow.CodeName}' duplicates trigger '{workflow.Trigger.ComponentCodeName}.{workflow.Trigger.EventKey}'.");
        }

        AiBuilderOutcomeReason? workflowReason = ValidateWorkflow(workflow, componentCodeNames, customFunctionsByName, prebuiltFunctionsByName);
        if (workflowReason is not null)
        {
            return workflowReason;
        }

        workflowCodeNames.Add(workflow.CodeName);
        workflowTriggerKeys.Add(triggerKey);
        workflowTriggerKeyByCodeName[workflow.CodeName] = triggerKey;
        return null;
    }

    private static AiBuilderOutcomeReason? ValidateDeleteWorkflowOperation(
        CanvasOperationDto operation,
        HashSet<string> workflowCodeNames,
        HashSet<string> workflowTriggerKeys,
        Dictionary<string, string> workflowTriggerKeyByCodeName)
    {
        if (string.IsNullOrWhiteSpace(operation.ComponentId))
        {
            return CreateValidationReason("AI returned deleteWorkflow without a workflow codeName.");
        }

        if (!workflowCodeNames.Contains(operation.ComponentId))
        {
            return CreateValidationReason($"AI tried to delete unknown workflow '{operation.ComponentId}'.");
        }

        workflowCodeNames.Remove(operation.ComponentId);
        if (workflowTriggerKeyByCodeName.Remove(operation.ComponentId, out string? triggerKey))
        {
            workflowTriggerKeys.Remove(triggerKey);
        }

        return null;
    }

    private static AiBuilderOutcomeReason? ValidateWorkflow(
        WorkflowDto workflow,
        IReadOnlySet<string> componentCodeNames,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> customFunctionsByName,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> prebuiltFunctionsByName)
    {
        Dictionary<string, WorkflowActionNodeDto> nodesById = new(StringComparer.Ordinal);
        foreach (WorkflowActionNodeDto node in workflow.Nodes)
        {
            if (string.IsNullOrWhiteSpace(node.Id) || string.IsNullOrWhiteSpace(node.ActionType))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' contains a node without id or actionType.");
            }

            if (!nodesById.TryAdd(node.Id, node))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' contains duplicate node id '{node.Id}'.");
            }
        }

        if (workflow.Nodes.Count > 1 && workflow.Edges.Count == 0)
        {
            return CreateValidationReason($"Workflow '{workflow.CodeName}' has multiple actions but no edges connecting them.");
        }

        foreach (WorkflowEdgeDto edge in workflow.Edges)
        {
            if (!_allowedRoutes.Contains(edge.Route) || !nodesById.ContainsKey(edge.FromNodeId) || !nodesById.ContainsKey(edge.ToNodeId))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' contains an invalid edge '{edge.FromNodeId}' -> '{edge.ToNodeId}'.");
            }
        }

        AiBuilderOutcomeReason? actionReason = ValidateActionReferences(workflow, nodesById, componentCodeNames, customFunctionsByName, prebuiltFunctionsByName);
        if (actionReason is not null)
        {
            return actionReason;
        }

        if (workflow.Nodes.Count > 1)
        {
            HashSet<string> nodesWithIncoming = workflow.Edges.Select(edge => edge.ToNodeId).ToHashSet(StringComparer.Ordinal);
            foreach (WorkflowActionNodeDto node in workflow.Nodes.Skip(1))
            {
                if (!nodesWithIncoming.Contains(node.Id))
                {
                    return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' is not connected to a previous action.");
                }
            }
        }

        return null;
    }

    private static AiBuilderOutcomeReason? ValidateActionReferences(
        WorkflowDto workflow,
        IReadOnlyDictionary<string, WorkflowActionNodeDto> nodesById,
        IReadOnlySet<string> componentCodeNames,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> customFunctionsByName,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> prebuiltFunctionsByName)
    {
        foreach (WorkflowActionNodeDto node in workflow.Nodes)
        {
            string? referencedNodeId = node.ActionType switch
            {
                "RunSql" => GetParamString(node.Params, "statement", "nodeId"),
                "SetBinding" => GetParamString(node.Params, "source", "nodeId"),
                _ => null,
            };

            if (!string.IsNullOrWhiteSpace(referencedNodeId) && !nodesById.ContainsKey(referencedNodeId))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' references missing source node '{referencedNodeId}'.");
            }

            if (!string.IsNullOrWhiteSpace(referencedNodeId)
                && node.ActionType == "RunSql"
                && !string.Equals(nodesById[referencedNodeId].ActionType, "BuildSql", StringComparison.Ordinal))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' must reference a BuildSql source node.");
            }

            if (!string.IsNullOrWhiteSpace(referencedNodeId)
                && node.ActionType == "SetBinding"
                && !string.Equals(nodesById[referencedNodeId].ActionType, "RunSql", StringComparison.Ordinal))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' must reference a RunSql source node.");
            }

            string? componentReference = node.ActionType switch
            {
                "ShowModal" => GetParamString(node.Params, "modalCodeName"),
                "SetBinding" => GetParamString(node.Params, "target", "componentCodeName"),
                "SaveToTable" => GetParamString(node.Params, "sourceFormComponentCodeName"),
                _ => null,
            };

            if (!string.IsNullOrWhiteSpace(componentReference) && !componentCodeNames.Contains(componentReference))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' references unknown component '{componentReference}'.");
            }

            AiBuilderOutcomeReason? moduleReason = node.ActionType switch
            {
                "CallCustomModule" => ValidateCallCustomModuleAction(workflow, node, customFunctionsByName),
                "CallPrebuiltModule" => ValidateCallPrebuiltModuleAction(workflow, node, prebuiltFunctionsByName),
                _ => null,
            };

            if (moduleReason is not null)
            {
                return moduleReason;
            }
        }

        return null;
    }

    private static AiBuilderOutcomeReason? ValidateCallCustomModuleAction(
        WorkflowDto workflow,
        WorkflowActionNodeDto node,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> customFunctionsByName)
    {
        string? functionName = GetParamString(node.Params, "functionName");
        if (string.IsNullOrWhiteSpace(functionName))
        {
            return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' requires a custom module functionName.");
        }

        if (!customFunctionsByName.ContainsKey(functionName))
        {
            return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' references custom module function '{functionName}', but custom_modules.py does not define a callable top-level function with ctx as the first parameter.");
        }

        return null;
    }

    private static AiBuilderOutcomeReason? ValidateCallPrebuiltModuleAction(
        WorkflowDto workflow,
        WorkflowActionNodeDto node,
        IReadOnlyDictionary<string, AiBuilderModuleFunction> prebuiltFunctionsByName)
    {
        string? functionName = GetParamString(node.Params, "functionName");
        if (string.IsNullOrWhiteSpace(functionName))
        {
            return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' requires a prebuilt module functionName.");
        }

        if (!prebuiltFunctionsByName.TryGetValue(functionName, out AiBuilderModuleFunction? function))
        {
            return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' references unknown prebuilt module function '{functionName}'.");
        }

        Dictionary<string, string>? namedArguments = GetStringDictionaryParam(node.Params, "namedArguments");
        if (namedArguments is null)
        {
            return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' requires namedArguments for prebuilt module function '{functionName}'.");
        }

        HashSet<string> expectedArguments = function.ParameterNames.Skip(1).ToHashSet(StringComparer.Ordinal);
        foreach (string providedArgument in namedArguments.Keys)
        {
            if (!expectedArguments.Contains(providedArgument))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' has unknown prebuilt argument '{providedArgument}' for function '{functionName}'.");
            }
        }

        foreach (string expectedArgument in expectedArguments)
        {
            if (!namedArguments.ContainsKey(expectedArgument))
            {
                return CreateValidationReason($"Workflow '{workflow.CodeName}' node '{node.Id}' is missing prebuilt argument '{expectedArgument}' for function '{functionName}'.");
            }
        }

        return null;
    }

    private static string? GetParamString(object? parameters, params string[] path)
    {
        if (parameters is null)
        {
            return null;
        }

        using JsonDocument document = JsonSerializer.SerializeToDocument(parameters, AiBuilderJsonOptions.CamelCase);
        JsonElement current = document.RootElement;
        foreach (string segment in path)
        {
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(segment, out current))
            {
                return null;
            }
        }

        return current.ValueKind == JsonValueKind.String ? current.GetString() : null;
    }

    private static Dictionary<string, string>? GetStringDictionaryParam(object? parameters, string propertyName)
    {
        if (parameters is null)
        {
            return null;
        }

        using JsonDocument document = JsonSerializer.SerializeToDocument(parameters, AiBuilderJsonOptions.CamelCase);
        JsonElement root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty(propertyName, out JsonElement property)
            || property.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        Dictionary<string, string> values = new(StringComparer.Ordinal);
        foreach (JsonProperty jsonProperty in property.EnumerateObject())
        {
            if (jsonProperty.Value.ValueKind != JsonValueKind.String)
            {
                return null;
            }

            values[jsonProperty.Name] = jsonProperty.Value.GetString() ?? string.Empty;
        }

        return values;
    }

    private static AiBuilderOutcomeReason CreateValidationReason(string detail)
    {
        return AiBuilderOutcomeFactory.CreateReason(
            AiBuilderReasonCode.OperationValidationFailed,
            "AI changes need review",
            "The builder generated changes that did not pass validation, so they were not applied.",
            [detail],
            ["Try a smaller request or describe the workflow sequence more explicitly."]);
    }
}
