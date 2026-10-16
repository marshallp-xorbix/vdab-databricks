using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

internal static class WorkflowReferenceValidator
{
    internal static Result Validate(WorkflowDefinitionModel workflowDefinition)
    {
        if (workflowDefinition == null)
        {
            return Result.Fail(new ValidationError("Workflow definition is required."));
        }

        if (workflowDefinition.Workflows == null)
        {
            return Result.Fail(new ValidationError("Workflow definition workflows collection is required."));
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

        Dictionary<string, WorkflowActionNodeModel> nodesById = BuildNodesById(workflow.Nodes);
        Dictionary<string, int> nodeIndexesById = BuildNodeIndexesById(workflow.Nodes);
        Dictionary<string, List<string>> incomingNodeIdsByNodeId = BuildIncomingNodeIdsByNodeId(workflow.Edges);

        foreach (WorkflowActionNodeModel actionNode in workflow.Nodes)
        {
            Result actionResult = actionNode switch
            {
                RunSqlActionModel runSqlNode => ValidateRunSqlNode(workflow, runSqlNode, nodesById, nodeIndexesById, incomingNodeIdsByNodeId),
                SetBindingActionModel setBindingNode => ValidateSetBindingNode(workflow, setBindingNode, nodesById, nodeIndexesById, incomingNodeIdsByNodeId),
                _ => Result.Ok(),
            };

            if (actionResult.IsFailed)
            {
                return actionResult;
            }
        }

        return Result.Ok();
    }

    private static Dictionary<string, WorkflowActionNodeModel> BuildNodesById(IEnumerable<WorkflowActionNodeModel> nodes)
    {
        Dictionary<string, WorkflowActionNodeModel> nodesById = new(StringComparer.Ordinal);

        foreach (WorkflowActionNodeModel node in nodes)
        {
            if (!nodesById.ContainsKey(node.Id))
            {
                nodesById.Add(node.Id, node);
            }
        }

        return nodesById;
    }

    private static Dictionary<string, int> BuildNodeIndexesById(IEnumerable<WorkflowActionNodeModel> nodes)
    {
        Dictionary<string, int> nodeIndexesById = new(StringComparer.Ordinal);
        int index = 0;

        foreach (WorkflowActionNodeModel node in nodes)
        {
            if (!nodeIndexesById.ContainsKey(node.Id))
            {
                nodeIndexesById.Add(node.Id, index);
            }

            index++;
        }

        return nodeIndexesById;
    }

    private static Dictionary<string, List<string>> BuildIncomingNodeIdsByNodeId(IEnumerable<WorkflowEdgeModel> edges)
    {
        Dictionary<string, List<string>> incomingNodeIdsByNodeId = new(StringComparer.Ordinal);

        foreach (WorkflowEdgeModel edge in edges)
        {
            if (!incomingNodeIdsByNodeId.TryGetValue(edge.ToNodeId, out List<string>? incomingNodeIds))
            {
                incomingNodeIds = new List<string>();
                incomingNodeIdsByNodeId.Add(edge.ToNodeId, incomingNodeIds);
            }

            incomingNodeIds.Add(edge.FromNodeId);
        }

        return incomingNodeIdsByNodeId;
    }

    private static Result ValidateRunSqlNode(
        WorkflowModel workflow,
        RunSqlActionModel actionNode,
        IReadOnlyDictionary<string, WorkflowActionNodeModel> nodesById,
        IReadOnlyDictionary<string, int> nodeIndexesById,
        IReadOnlyDictionary<string, List<string>> incomingNodeIdsByNodeId)
    {
        if (actionNode.Statement == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' requires a statement source."));
        }

        if (string.IsNullOrWhiteSpace(actionNode.Statement.NodeId))
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' requires a source BuildSql node."));
        }

        if (!nodesById.TryGetValue(actionNode.Statement.NodeId, out WorkflowActionNodeModel? sourceNode))
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' references missing BuildSql source node '{actionNode.Statement.NodeId}'."));
        }

        if (sourceNode is not BuildSqlActionModel buildSqlNode)
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' requires source node '{actionNode.Statement.NodeId}' to be a BuildSql action."));
        }

        if (!IsValidPriorReference(actionNode.Id, actionNode.Statement.NodeId, nodeIndexesById, incomingNodeIdsByNodeId))
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' references BuildSql node '{actionNode.Statement.NodeId}' that does not execute before it."));
        }

        if (!Enum.IsDefined(buildSqlNode.SqlSourceKind))
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' references BuildSql node '{actionNode.Statement.NodeId}' with unsupported sqlSourceKind '{buildSqlNode.SqlSourceKind}'."));
        }

        return Result.Ok();
    }

    private static Result ValidateSetBindingNode(
        WorkflowModel workflow,
        SetBindingActionModel actionNode,
        IReadOnlyDictionary<string, WorkflowActionNodeModel> nodesById,
        IReadOnlyDictionary<string, int> nodeIndexesById,
        IReadOnlyDictionary<string, List<string>> incomingNodeIdsByNodeId)
    {
        if (actionNode.Source == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' requires a SetBinding source reference."));
        }

        if (string.IsNullOrWhiteSpace(actionNode.Source.NodeId))
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' requires a source RunSql node."));
        }

        if (!nodesById.TryGetValue(actionNode.Source.NodeId, out WorkflowActionNodeModel? sourceNode))
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' references missing RunSql source node '{actionNode.Source.NodeId}'."));
        }

        if (sourceNode is not RunSqlActionModel)
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' requires source node '{actionNode.Source.NodeId}' to be a RunSql action."));
        }

        if (!IsValidPriorReference(actionNode.Id, actionNode.Source.NodeId, nodeIndexesById, incomingNodeIdsByNodeId))
        {
            return Result.Fail(new ValidationError($"Workflow '{workflow.CodeName}' node '{actionNode.Id}' references RunSql node '{actionNode.Source.NodeId}' that does not execute before it."));
        }

        return Result.Ok();
    }

    private static bool IsValidPriorReference(
        string currentNodeId,
        string sourceNodeId,
        IReadOnlyDictionary<string, int> nodeIndexesById,
        IReadOnlyDictionary<string, List<string>> incomingNodeIdsByNodeId)
    {
        HashSet<string> reachablePriorNodeIds = GetReachablePriorNodeIds(currentNodeId, incomingNodeIdsByNodeId);
        if (reachablePriorNodeIds.Contains(sourceNodeId))
        {
            return true;
        }

        if (!nodeIndexesById.TryGetValue(currentNodeId, out int currentNodeIndex) ||
            !nodeIndexesById.TryGetValue(sourceNodeId, out int sourceNodeIndex))
        {
            return false;
        }

        return sourceNodeIndex < currentNodeIndex;
    }

    private static HashSet<string> GetReachablePriorNodeIds(
        string currentNodeId,
        IReadOnlyDictionary<string, List<string>> incomingNodeIdsByNodeId)
    {
        HashSet<string> reachableNodeIds = new(StringComparer.Ordinal);
        HashSet<string> visitedNodeIds = new(StringComparer.Ordinal);
        Queue<string> pendingNodeIds = new();

        if (incomingNodeIdsByNodeId.TryGetValue(currentNodeId, out List<string>? incomingNodeIds))
        {
            foreach (string incomingNodeId in incomingNodeIds)
            {
                pendingNodeIds.Enqueue(incomingNodeId);
            }
        }

        while (pendingNodeIds.Count > 0)
        {
            string nodeId = pendingNodeIds.Dequeue();
            if (string.Equals(nodeId, currentNodeId, StringComparison.Ordinal) || !visitedNodeIds.Add(nodeId))
            {
                continue;
            }

            reachableNodeIds.Add(nodeId);

            if (!incomingNodeIdsByNodeId.TryGetValue(nodeId, out List<string>? parentNodeIds))
            {
                continue;
            }

            foreach (string parentNodeId in parentNodeIds)
            {
                if (!visitedNodeIds.Contains(parentNodeId))
                {
                    pendingNodeIds.Enqueue(parentNodeId);
                }
            }
        }

        return reachableNodeIds;
    }
}