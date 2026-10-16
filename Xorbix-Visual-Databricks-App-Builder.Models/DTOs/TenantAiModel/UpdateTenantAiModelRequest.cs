namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.TenantAiModel;

public class UpdateTenantAiModelRequest
{
    public required string DisplayName { get; set; }

    public int DatabricksConnectionId { get; set; }

    public required string EndpointName { get; set; }

    public string? AccessToken { get; set; }
}
