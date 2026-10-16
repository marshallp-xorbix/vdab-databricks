using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Shared orchestration for creating and configuring Databricks apps via the Databricks REST API.
/// </summary>
public interface IDatabricksAppProvisioningService
{
    /// <summary>
    /// Creates a Databricks app and returns canonical fields from Databricks.
    /// UC SQL in generated apps uses the app service principal; no user API scopes are required.
    /// </summary>
    /// <param name="userId">The authenticated user ID.</param>
    /// <param name="workspaceUrl">Databricks workspace URL.</param>
    /// <param name="workspaceConnectionId">Workspace connection identifier for logging.</param>
    /// <param name="name">Requested Databricks app name.</param>
    /// <param name="description">Optional Databricks app description.</param>
    /// <param name="resources">Optional Databricks resources payload.</param>
    /// <param name="userSafeUpstreamMessage">User-safe upstream error message.</param>
    /// <returns>A result containing canonical Databricks app details.</returns>
    Task<Result<CreatedDatabricksAppDto>> CreateDatabricksAppAsync(
        Guid userId,
        string workspaceUrl,
        int workspaceConnectionId,
        string name,
        string? description,
        List<DatabricksAppResource>? resources,
        string userSafeUpstreamMessage);
}
