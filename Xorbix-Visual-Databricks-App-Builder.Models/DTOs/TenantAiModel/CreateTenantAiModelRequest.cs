namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.TenantAiModel;

public class CreateTenantAiModelRequest
{
    public required string DisplayName { get; set; }

    public int DatabricksConnectionId { get; set; }

    public required string EndpointName { get; set; }

    public required string AccessToken { get; set; }
}
