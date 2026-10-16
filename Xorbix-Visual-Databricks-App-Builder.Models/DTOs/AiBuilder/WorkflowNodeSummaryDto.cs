using System.Text.Json;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

public class WorkflowNodeSummaryDto
{
    public string NodeId { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public JsonElement? Params { get; set; }
}
