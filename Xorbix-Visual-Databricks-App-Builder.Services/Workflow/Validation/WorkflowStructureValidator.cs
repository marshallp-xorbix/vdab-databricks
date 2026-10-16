using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

internal static class WorkflowStructureValidator
{
    internal static Result Validate(WorkflowDefinitionModel workflowDefinition)
    {
        if (workflowDefinition == null)
        {
            return Result.Fail(new ValidationError("Workflow definition is required."));
        }

        Result workflowSetResult = ValidateWorkflowSet(workflowDefinition.Workflows);
        if (workflowSetResult.IsFailed)
        {
            return workflowSetResult;
        }

        foreach (WorkflowModel workflow in workflowDefinition.Workflows)
        {
            Result workflowResult = ValidateWorkflow(workflow);
            if (workflowResult.IsFailed)
            {
                return workflowResult;
            }
        }

        return Result.Ok();
    }

    private static Result ValidateWorkflowSet(List<WorkflowModel>? workflows)
    {
        if (workflows == null)
        {
            return Result.Fail(new ValidationError("Workflow definition workflows collection is required."));
        }

        Dictionary<string, int> workflowCountsByCodeName = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, int> triggerCounts = new(StringComparer.OrdinalIgnoreCase);

        foreach (WorkflowModel workflow in workflows)
        {
            if (!workflowCountsByCodeName.TryAdd(workflow.CodeName, 1))
            {
                workflowCountsByCodeName[workflow.CodeName]++;
            }

            string triggerKey = BuildTriggerKey(workflow.Trigger.ComponentCodeName, workflow.Trigger.EventKey);
            if (!triggerCounts.TryAdd(triggerKey, 1))
            {
                triggerCounts[triggerKey]++;
            }
        }

        foreach (WorkflowModel workflow in workflows)
        {
            if (workflowCountsByCodeName[workflow.CodeName] > 1)
            {
                return Result.Fail(new ValidationError(
                    $"Workflow code name '{workflow.CodeName}' is duplicated. Choose a unique workflow code name."));
            }

            string triggerKey = BuildTriggerKey(workflow.Trigger.ComponentCodeName, workflow.Trigger.EventKey);
            if (triggerCounts[triggerKey] > 1)
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{workflow.CodeName}' duplicates trigger '{workflow.Trigger.ComponentCodeName}.{workflow.Trigger.EventKey}'. Only one workflow can use a given trigger."));
            }
        }

        return Result.Ok();
    }

    private static Result ValidateWorkflow(WorkflowModel workflow)
    {
        if (workflow.Nodes == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' requires a nodes collection."));
        }

        if (workflow.Edges == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' requires an edges collection."));
        }

        List<string> nodeIds = workflow.Nodes.Select(node => node.Id).ToList();
        if (nodeIds.Count != nodeIds.Distinct(StringComparer.Ordinal).Count())
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' contains duplicate node IDs."));
        }

        HashSet<string> nodeIdSet = nodeIds.ToHashSet(StringComparer.Ordinal);
        foreach (WorkflowEdgeModel edge in workflow.Edges)
        {
            if (!Enum.IsDefined(edge.Route))
            {
                return Result.Fail(new ValidationError(
                    $"Workflow '{workflow.CodeName}' edge '{edge.FromNodeId}' -> '{edge.ToNodeId}' has unsupported route '{edge.Route}'."));
            }

            if (!nodeIdSet.Contains(edge.FromNodeId) || !nodeIdSet.Contains(edge.ToNodeId))
            {
                return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' contains an edge that references a missing node."));
            }
        }

        return Result.Ok();
    }

    private static string BuildTriggerKey(string componentCodeName, string eventKey)
    {
        return $"{componentCodeName}::{eventKey}";
    }
}