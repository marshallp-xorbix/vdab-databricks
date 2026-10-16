namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

public class AiBuilderModelOptionDto
{
    public int? Id { get; set; }

    public required string DisplayName { get; set; }

    public AiModelSource Source { get; set; }

    public required string EndpointName { get; set; }

    public string? ConnectionDisplayName { get; set; }

    public bool IsConfigured { get; set; } = true;
}
