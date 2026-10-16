using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

internal static class WorkflowTestDefinitionFactory
{
    public static WorkflowDefinitionDto CreateWorkflowDefinition(params WorkflowDto[] workflows)
    {
        return new WorkflowDefinitionDto
        {
            Workflows = workflows.ToList(),
        };
    }

    public static WorkflowDto CreateWorkflow(
        string codeName,
        string triggerComponentCodeName,
        string eventKey,
        IEnumerable<WorkflowNodeDto>? nodes = null,
        IEnumerable<WorkflowEdgeDto>? edges = null)
    {
        return new WorkflowDto
        {
            CodeName = codeName,
            Trigger = CreateTrigger(triggerComponentCodeName, eventKey),
            Nodes = nodes?.ToList() ?? new List<WorkflowNodeDto>(),
            Edges = edges?.ToList() ?? new List<WorkflowEdgeDto>(),
        };
    }

    public static WorkflowTriggerDto CreateTrigger(string componentCodeName, string eventKey)
    {
        return new WorkflowTriggerDto
        {
            ComponentCodeName = componentCodeName,
            EventKey = eventKey,
        };
    }

    public static WorkflowNodeDto CreateNode(string id, string actionType, Dictionary<string, object?>? parameters = null)
    {
        return new WorkflowNodeDto
        {
            Id = id,
            ActionType = actionType,
            Params = parameters ?? new Dictionary<string, object?>(),
        };
    }

    public static WorkflowEdgeDto CreateEdge(string fromNodeId, string toNodeId, string route)
    {
        return new WorkflowEdgeDto
        {
            FromNodeId = fromNodeId,
            ToNodeId = toNodeId,
            Route = route,
        };
    }
}