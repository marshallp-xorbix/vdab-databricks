namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

public class WorkflowSummaryDto
{
    public string CodeName { get; set; } = string.Empty;
    public string TriggerComponentCodeName { get; set; } = string.Empty;
    public string TriggerEventKey { get; set; } = string.Empty;
    public List<WorkflowNodeSummaryDto> Nodes { get; set; } = [];
    public List<WorkflowEdgeDto> Edges { get; set; } = [];
}
