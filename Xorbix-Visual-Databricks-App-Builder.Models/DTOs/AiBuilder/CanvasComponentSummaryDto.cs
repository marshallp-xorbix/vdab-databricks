using System.Text.Json;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

public class CanvasComponentSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string CodeName { get; set; } = string.Empty;
    public JsonElement? Props { get; set; }
    public List<string> Children { get; set; } = [];
}
