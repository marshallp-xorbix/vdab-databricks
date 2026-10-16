using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Validates that a Databricks workspace connection can be used by a tenant.
/// </summary>
public interface IDatabricksWorkspaceConnectionValidator
{
    /// <summary>
    /// Validates workspace connection existence, tenant ownership, and workspace URL.
    /// </summary>
    /// <param name="tenantId">Authenticated tenant identifier.</param>
    /// <param name="workspaceConnectionId">Databricks connection identifier.</param>
    /// <returns>A result containing the validated connection.</returns>
    Task<Result<DatabricksConnection>> ValidateWorkspaceConnectionForTenantAsync(
        Guid tenantId,
        int workspaceConnectionId);
}
