namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.TenantAiModel;

public class TenantAiModelDto
{
    public int TenantAiModelId { get; set; }

    public Guid TenantId { get; set; }

    public int DatabricksConnectionId { get; set; }

    public required string DisplayName { get; set; }

    public required string EndpointName { get; set; }

    public required string DatabricksConnectionDisplayName { get; set; }

    public required string WorkspaceUrl { get; set; }

    public bool HasAccessToken { get; set; }

    public DateTime CreatedOn { get; set; }

    public Guid CreatedByUserId { get; set; }
}
