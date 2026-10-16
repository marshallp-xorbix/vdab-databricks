using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

public sealed class WorkflowActionDefinitionRegistry
{
    private readonly IReadOnlyDictionary<WorkflowActionKind, IWorkflowActionDefinition> _definitions;

    public WorkflowActionDefinitionRegistry(IEnumerable<IWorkflowActionDefinition> definitions)
    {
        _definitions = BuildDefinitions(definitions);
    }

    internal IReadOnlyCollection<IWorkflowActionDefinition> Definitions => _definitions.Values.ToArray();

    internal Result<IWorkflowActionDefinition> GetDefinition(WorkflowActionKind actionKind)
    {
        if (_definitions.TryGetValue(actionKind, out IWorkflowActionDefinition? definition))
        {
            return Result.Ok(definition);
        }

        return Result.Fail<IWorkflowActionDefinition>(new ValidationError($"No workflow action definition is registered for action kind '{actionKind}'."));
    }

    private static IReadOnlyDictionary<WorkflowActionKind, IWorkflowActionDefinition> BuildDefinitions(IEnumerable<IWorkflowActionDefinition> definitions)
    {
        List<IWorkflowActionDefinition> definitionList = definitions.ToList();
        Dictionary<WorkflowActionKind, IWorkflowActionDefinition> definitionsByKind = new();

        foreach (IWorkflowActionDefinition definition in definitionList)
        {
            if (!definitionsByKind.TryAdd(definition.ActionKind, definition))
            {
                throw new InvalidOperationException($"Multiple workflow action definitions are registered for action kind '{definition.ActionKind}'.");
            }
        }

        WorkflowActionKind[] supportedActionKinds = Enum.GetValues<WorkflowActionKind>();
        WorkflowActionKind[] missingActionKinds = supportedActionKinds
            .Where(actionKind => !definitionsByKind.ContainsKey(actionKind))
            .ToArray();

        if (missingActionKinds.Length > 0)
        {
            string missingKinds = string.Join(", ", missingActionKinds.Select(actionKind => actionKind.ToString()));
            throw new InvalidOperationException($"Workflow action definitions are missing for action kinds: {missingKinds}.");
        }

        return definitionsByKind;
    }
}