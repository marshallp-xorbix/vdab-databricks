using FluentResults;
using System.Text.RegularExpressions;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

public sealed partial class WorkflowTemplateValidator
{
    [GeneratedRegex(@"^[A-Za-z_][A-Za-z0-9_]*$")]
    private static partial Regex ValidCodeNamePattern();

    private readonly WorkflowActionValidator _actionValidator;

    public WorkflowTemplateValidator(WorkflowActionValidator actionValidator)
    {
        _actionValidator = actionValidator;
    }

    internal Result Validate(
        List<VdabComponentDto> components,
        WorkflowDefinitionDto workflowDefinition,
        IReadOnlyList<NormalizedAppResourceDto>? normalizedAppResources = null)
    {
        if (components == null)
        {
            return Result.Fail(new ValidationError("Workflow validation requires a component collection."));
        }

        if (workflowDefinition == null)
        {
            return Result.Fail(new ValidationError("Workflow definition is required."));
        }

        Result<WorkflowDefinitionModel> parseResult = WorkflowDefinitionParser.Parse(workflowDefinition);
        if (parseResult.IsFailed)
        {
            return Result.Fail(parseResult.Errors);
        }

        WorkflowDefinitionModel parsedWorkflowDefinition = parseResult.Value;
        Result orchestrationResult = ValidateWorkflowOrchestration(parsedWorkflowDefinition, components);
        if (orchestrationResult.IsFailed)
        {
            return orchestrationResult;
        }

        Result structureResult = WorkflowStructureValidator.Validate(parsedWorkflowDefinition);
        if (structureResult.IsFailed)
        {
            return structureResult;
        }

        Result actionResult = _actionValidator.Validate(parsedWorkflowDefinition, components, normalizedAppResources);
        if (actionResult.IsFailed)
        {
            return actionResult;
        }

        Result referenceResult = WorkflowReferenceValidator.Validate(parsedWorkflowDefinition);
        if (referenceResult.IsFailed)
        {
            return referenceResult;
        }

        return Result.Ok();
    }

    private static Result ValidateWorkflowOrchestration(
        WorkflowDefinitionModel workflowDefinition,
        List<VdabComponentDto> components)
    {
        Dictionary<string, VdabComponentDto> componentsByCodeName = components
            .Where(component => !string.IsNullOrWhiteSpace(component.CodeName))
            .GroupBy(component => component.CodeName!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        foreach (WorkflowModel workflow in workflowDefinition.Workflows)
        {
            if (string.IsNullOrWhiteSpace(workflow.CodeName))
            {
                return Result.Fail(new ValidationError("Every workflow must have a code name."));
            }

            if (!ValidCodeNamePattern().IsMatch(workflow.CodeName))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{workflow.CodeName}' has an invalid code name. Code names must start with a letter or underscore and contain only letters, digits, and underscores."));
            }

            if (!componentsByCodeName.TryGetValue(workflow.Trigger.ComponentCodeName, out VdabComponentDto? triggerComponent))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{workflow.CodeName}' references missing trigger component '{workflow.Trigger.ComponentCodeName}'."));
            }

            List<string> supportedEvents = triggerComponent.SupportedEvents ?? new List<string>();
            if (!supportedEvents.Any(eventName => string.Equals(eventName, workflow.Trigger.EventKey, StringComparison.OrdinalIgnoreCase)))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{workflow.CodeName}' uses unsupported trigger event '{workflow.Trigger.EventKey}' for component '{workflow.Trigger.ComponentCodeName}'."));
            }
        }

        return Result.Ok();
    }
}
