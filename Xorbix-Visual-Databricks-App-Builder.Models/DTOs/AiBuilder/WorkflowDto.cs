namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

public class WorkflowDto
{
    public string CodeName { get; set; } = string.Empty;
    public WorkflowTriggerDto Trigger { get; set; } = new();
    public List<WorkflowActionNodeDto> Nodes { get; set; } = [];
    public List<WorkflowEdgeDto> Edges { get; set; } = [];
}

public class WorkflowTriggerDto
{
    public string ComponentCodeName { get; set; } = string.Empty;
    public string EventKey { get; set; } = string.Empty;
}

public class WorkflowActionNodeDto
{
    public string Id { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public int SchemaVersion { get; set; } = 1;
    public object Params { get; set; } = new { };
}

public class WorkflowEdgeDto
{
    public string FromNodeId { get; set; } = string.Empty;
    public string ToNodeId { get; set; } = string.Empty;
    public string Route { get; set; } = "onSuccess";
}
