using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

public sealed class WorkflowActionValidator
{
    private readonly WorkflowActionDefinitionRegistry _definitionRegistry;

    public WorkflowActionValidator(WorkflowActionDefinitionRegistry definitionRegistry)
    {
        _definitionRegistry = definitionRegistry;
    }

    internal Result Validate(
        WorkflowDefinitionModel workflowDefinition,
        List<VdabComponentDto> components,
        IReadOnlyList<NormalizedAppResourceDto>? normalizedAppResources = null)
    {
        if (workflowDefinition == null)
        {
            return Result.Fail(new ValidationError("Workflow definition is required."));
        }

        if (components == null)
        {
            return Result.Fail(new ValidationError("Workflow action validation requires a component collection."));
        }

        Dictionary<string, VdabComponentDto> componentsByCodeName = components
            .Where(component => !string.IsNullOrWhiteSpace(component.CodeName))
            .GroupBy(component => component.CodeName, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key!, group => group.First(), StringComparer.OrdinalIgnoreCase);

        Dictionary<string, VdabComponentDto> componentsById = components
            .Where(component => !string.IsNullOrWhiteSpace(component.Id))
            .GroupBy(component => component.Id, StringComparer.Ordinal)
            .ToDictionary(group => group.Key!, group => group.First(), StringComparer.Ordinal);

        foreach (WorkflowModel workflow in workflowDefinition.Workflows)
        {
            WorkflowActionValidationContext context = new()
            {
                WorkflowDefinition = workflowDefinition,
                Workflow = workflow,
                ComponentsByCodeName = componentsByCodeName,
                ComponentsById = componentsById,
                NormalizedAppResources = normalizedAppResources,
            };

            foreach (WorkflowActionNodeModel actionNode in workflow.Nodes)
            {
                Result<IWorkflowActionDefinition> definitionResult = _definitionRegistry.GetDefinition(actionNode.ActionType);
                if (definitionResult.IsFailed)
                {
                    return Result.Fail(definitionResult.Errors);
                }

                Result actionResult = definitionResult.Value.Validate(actionNode, context);
                if (actionResult.IsFailed)
                {
                    return actionResult;
                }
            }
        }

        return Result.Ok();
    }
}