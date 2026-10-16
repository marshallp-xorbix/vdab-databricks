using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

public class AiBuilderRequest
{
    [Required]
    public string Prompt { get; set; } = string.Empty;
    public int AppId { get; set; }
    public List<CanvasComponentSummaryDto> CurrentComponents { get; set; } = [];
    public List<WorkflowSummaryDto> CurrentWorkflows { get; set; } = [];
    public List<ConversationMessageDto> ConversationHistory { get; set; } = [];
    public string CustomModulesCode { get; set; } = string.Empty;
    public int? AiModelId { get; set; }
}
