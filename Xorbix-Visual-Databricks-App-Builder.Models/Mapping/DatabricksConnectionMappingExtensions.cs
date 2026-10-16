using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Mapping;

/// <summary>
/// Mapping helpers for Databricks workspace connection API contracts.
/// </summary>
public static class DatabricksConnectionMappingExtensions
{
    /// <summary>
    /// Converts a stored Databricks connection entity to the public API DTO.
    /// </summary>
    public static DatabricksConnectionDto ToDto(this DatabricksConnection connection)
    {
        return new DatabricksConnectionDto
        {
            PkId = connection.PkId,
            TenantId = connection.TenantId,
            OwnerId = connection.OwnerId,
            WorkspaceUrl = connection.WorkspaceUrl,
            WorkspaceDisplayName = connection.WorkspaceDisplayName,
            ClientId = connection.ClientId,
            AccessTokenTtlMinutes = connection.AccessTokenTtlMinutes,
            RefreshTokenLifespanMinutes = connection.RefreshTokenLifespanMinutes,
            CreatedOn = connection.CreatedOn,
            CreatedBy = connection.CreatedBy,
            ModifiedOn = connection.ModifiedOn,
            ModifiedBy = connection.ModifiedBy
        };
    }
}
