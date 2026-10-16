using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.TenantAiModel;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Mapping;

/// <summary>
/// Mapping extensions for tenant AI model entities and DTOs.
/// </summary>
public static class TenantAiModelMappingExtensions
{
    /// <summary>
    /// Maps a tenant AI model entity to its API DTO without exposing secrets.
    /// </summary>
    public static TenantAiModelDto ToDto(this TenantAiModel entity)
    {
        return new TenantAiModelDto
        {
            TenantAiModelId = entity.TenantAiModelId,
            TenantId = entity.TenantId,
            DatabricksConnectionId = entity.DatabricksConnectionId,
            DisplayName = entity.DisplayName,
            EndpointName = entity.EndpointName,
            DatabricksConnectionDisplayName = entity.DatabricksConnection?.WorkspaceDisplayName ?? string.Empty,
            WorkspaceUrl = entity.DatabricksConnection?.WorkspaceUrl ?? string.Empty,
            HasAccessToken = !string.IsNullOrWhiteSpace(entity.AccessToken),
            CreatedOn = entity.CreatedOn,
            CreatedByUserId = entity.CreatedByUserId,
        };
    }
}
