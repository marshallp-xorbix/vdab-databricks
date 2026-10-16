namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;

/// <summary>
/// Transport DTO for workflow documents received from the client.
/// Parsed workflow logic should move into typed workflow models after deserialization.
/// </summary>
public class WorkflowDefinitionDto
{
    public int Version { get; set; } = 1;
    public List<WorkflowDto> Workflows { get; set; } = new();
}

/// <summary>
/// Transport DTO for a single workflow definition.
/// </summary>
public class WorkflowDto
{
    public required string CodeName { get; set; }
    public required WorkflowTriggerDto Trigger { get; set; }
    public List<WorkflowNodeDto> Nodes { get; set; } = new();
    public List<WorkflowEdgeDto> Edges { get; set; } = new();
}

/// <summary>
/// Transport DTO for workflow trigger metadata.
/// </summary>
public class WorkflowTriggerDto
{
    public required string ComponentCodeName { get; set; }
    public required string EventKey { get; set; }
}

/// <summary>
/// Transport DTO for a workflow action node.
/// Params intentionally remain a raw key-value payload at the DTO boundary.
/// </summary>
public class WorkflowNodeDto
{
    public required string Id { get; set; }
    public required string ActionType { get; set; }
    public Dictionary<string, object?> Params { get; set; } = new();
}

/// <summary>
/// Transport DTO for workflow graph edges.
/// Route remains a raw string until parsed into the typed workflow route model.
/// </summary>
public class WorkflowEdgeDto
{
    public required string FromNodeId { get; set; }
    public required string ToNodeId { get; set; }
    public required string Route { get; set; }
}
