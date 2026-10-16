namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

public class AiBuilderSelectedModelDto
{
    public int? AiModelId { get; set; }

    public required string DisplayName { get; set; }

    public AiModelSource Source { get; set; }
}
