using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;

internal static class WorkflowDefinitionParser
{
    internal static Result<WorkflowDefinitionModel> Parse(WorkflowDefinitionDto workflowDefinitionDto)
    {
        if (workflowDefinitionDto == null)
        {
            return Result.Fail<WorkflowDefinitionModel>(new ValidationError("Workflow definition is required."));
        }

        Result<List<WorkflowModel>> workflowsResult = ParseWorkflows(workflowDefinitionDto.Workflows);
        if (workflowsResult.IsFailed)
        {
            return Result.Fail<WorkflowDefinitionModel>(workflowsResult.Errors);
        }

        WorkflowDefinitionModel model = new()
        {
            Version = workflowDefinitionDto.Version,
            Workflows = workflowsResult.Value,
        };

        return Result.Ok(model);
    }

    private static Result<List<WorkflowModel>> ParseWorkflows(List<WorkflowDto>? workflowDtos)
    {
        if (workflowDtos == null)
        {
            return Result.Fail<List<WorkflowModel>>(new ValidationError("Workflow definition workflows collection is required."));
        }

        List<WorkflowModel> workflows = new();
        for (int index = 0; index < workflowDtos.Count; index++)
        {
            WorkflowDto workflowDto = workflowDtos[index];
            Result<WorkflowModel> workflowResult = ParseWorkflow(workflowDto, index);
            if (workflowResult.IsFailed)
            {
                return Result.Fail<List<WorkflowModel>>(workflowResult.Errors);
            }

            workflows.Add(workflowResult.Value);
        }

        return Result.Ok(workflows);
    }

    private static Result<WorkflowModel> ParseWorkflow(WorkflowDto? workflowDto, int workflowIndex)
    {
        if (workflowDto == null)
        {
            return Result.Fail<WorkflowModel>(new ValidationError($"Workflow at index {workflowIndex} is required."));
        }

        if (string.IsNullOrWhiteSpace(workflowDto.CodeName))
        {
            return Result.Fail<WorkflowModel>(new ValidationError($"Workflow at index {workflowIndex} requires a code name."));
        }

        Result<WorkflowTriggerModel> triggerResult = ParseTrigger(workflowDto.Trigger, workflowDto.CodeName);
        if (triggerResult.IsFailed)
        {
            return Result.Fail<WorkflowModel>(triggerResult.Errors);
        }

        Result<List<WorkflowActionNodeModel>> nodesResult = ParseNodes(workflowDto.Nodes, workflowDto.CodeName);
        if (nodesResult.IsFailed)
        {
            return Result.Fail<WorkflowModel>(nodesResult.Errors);
        }

        Result<List<WorkflowEdgeModel>> edgesResult = ParseEdges(workflowDto.Edges, workflowDto.CodeName);
        if (edgesResult.IsFailed)
        {
            return Result.Fail<WorkflowModel>(edgesResult.Errors);
        }

        WorkflowModel model = new()
        {
            CodeName = workflowDto.CodeName,
            Trigger = triggerResult.Value,
            Nodes = nodesResult.Value,
            Edges = edgesResult.Value,
        };

        return Result.Ok(model);
    }

    private static Result<WorkflowTriggerModel> ParseTrigger(WorkflowTriggerDto? triggerDto, string workflowCodeName)
    {
        if (triggerDto == null)
        {
            return Result.Fail<WorkflowTriggerModel>(new ValidationError($"Workflow '{workflowCodeName}' requires a trigger."));
        }

        if (string.IsNullOrWhiteSpace(triggerDto.ComponentCodeName))
        {
            return Result.Fail<WorkflowTriggerModel>(new ValidationError($"Workflow '{workflowCodeName}' requires trigger.componentCodeName."));
        }

        if (string.IsNullOrWhiteSpace(triggerDto.EventKey))
        {
            return Result.Fail<WorkflowTriggerModel>(new ValidationError($"Workflow '{workflowCodeName}' requires trigger.eventKey."));
        }

        WorkflowTriggerModel model = new()
        {
            ComponentCodeName = triggerDto.ComponentCodeName,
            EventKey = triggerDto.EventKey,
        };

        return Result.Ok(model);
    }

    private static Result<List<WorkflowActionNodeModel>> ParseNodes(List<WorkflowNodeDto>? nodeDtos, string workflowCodeName)
    {
        if (nodeDtos == null)
        {
            return Result.Fail<List<WorkflowActionNodeModel>>(new ValidationError($"Workflow '{workflowCodeName}' requires a nodes collection."));
        }

        List<WorkflowActionNodeModel> nodes = new();
        foreach (WorkflowNodeDto? nodeDto in nodeDtos)
        {
            if (nodeDto == null)
            {
                return Result.Fail<List<WorkflowActionNodeModel>>(new ValidationError($"Workflow '{workflowCodeName}' contains a null node."));
            }

            Result<WorkflowActionNodeModel> nodeResult = WorkflowActionParser.Parse(nodeDto);
            if (nodeResult.IsFailed)
            {
                return Result.Fail<List<WorkflowActionNodeModel>>(nodeResult.Errors);
            }

            nodes.Add(nodeResult.Value);
        }

        return Result.Ok(nodes);
    }

    private static Result<List<WorkflowEdgeModel>> ParseEdges(List<WorkflowEdgeDto>? edgeDtos, string workflowCodeName)
    {
        if (edgeDtos == null)
        {
            return Result.Fail<List<WorkflowEdgeModel>>(new ValidationError($"Workflow '{workflowCodeName}' requires an edges collection."));
        }

        List<WorkflowEdgeModel> edges = new();
        foreach (WorkflowEdgeDto? edgeDto in edgeDtos)
        {
            Result<WorkflowEdgeModel> edgeResult = ParseEdge(edgeDto, workflowCodeName);
            if (edgeResult.IsFailed)
            {
                return Result.Fail<List<WorkflowEdgeModel>>(edgeResult.Errors);
            }

            edges.Add(edgeResult.Value);
        }

        return Result.Ok(edges);
    }

    private static Result<WorkflowEdgeModel> ParseEdge(WorkflowEdgeDto? edgeDto, string workflowCodeName)
    {
        if (edgeDto == null)
        {
            return Result.Fail<WorkflowEdgeModel>(new ValidationError($"Workflow '{workflowCodeName}' contains a null edge."));
        }

        if (string.IsNullOrWhiteSpace(edgeDto.FromNodeId))
        {
            return Result.Fail<WorkflowEdgeModel>(new ValidationError($"Workflow '{workflowCodeName}' has an edge with a missing fromNodeId."));
        }

        if (string.IsNullOrWhiteSpace(edgeDto.ToNodeId))
        {
            return Result.Fail<WorkflowEdgeModel>(new ValidationError($"Workflow '{workflowCodeName}' has an edge with a missing toNodeId."));
        }

        Result<WorkflowRouteModel> routeResult = ParseRoute(edgeDto.Route, workflowCodeName, edgeDto.FromNodeId, edgeDto.ToNodeId);
        if (routeResult.IsFailed)
        {
            return Result.Fail<WorkflowEdgeModel>(routeResult.Errors);
        }

        WorkflowEdgeModel model = new()
        {
            FromNodeId = edgeDto.FromNodeId,
            ToNodeId = edgeDto.ToNodeId,
            Route = routeResult.Value,
        };

        return Result.Ok(model);
    }

    private static Result<WorkflowRouteModel> ParseRoute(string? route, string workflowCodeName, string fromNodeId, string toNodeId)
    {
        if (string.IsNullOrWhiteSpace(route))
        {
            return Result.Fail<WorkflowRouteModel>(new ValidationError($"Workflow '{workflowCodeName}' edge '{fromNodeId}' -> '{toNodeId}' requires a route."));
        }

        return route.Trim().ToLowerInvariant() switch
        {
            "onsuccess" => Result.Ok(WorkflowRouteModel.OnSuccess),
            "onerror" => Result.Ok(WorkflowRouteModel.OnError),
            "always" => Result.Ok(WorkflowRouteModel.Always),
            _ => Result.Fail<WorkflowRouteModel>(new ValidationError($"Workflow '{workflowCodeName}' edge '{fromNodeId}' -> '{toNodeId}' has unsupported route '{route}'.")),
        };
    }
}