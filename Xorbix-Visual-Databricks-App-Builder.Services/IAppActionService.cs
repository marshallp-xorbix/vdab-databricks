using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public interface IAppActionService
{
    /// <summary>
    /// Retrieves the Databricks compute status for an app.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="appId">The local app ID.</param>
    /// <returns>A Result containing the app compute status response.</returns>
    Task<Result<AppStatusResponse>> GetAppStatusAsync(Guid userId, Guid tenantId, int appId);

    /// <summary>
    /// Retrieves the full Databricks app details including legacy fields and normalized <c>appSettings</c>
    /// (resources, compute size, warnings).
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="appId">The local app ID.</param>
    /// <returns>A Result containing the full Databricks app details.</returns>
    Task<Result<DatabricksAppResponse>> GetAppDetailsAsync(Guid userId, Guid tenantId, int appId);

    /// <summary>
    /// Starts the Databricks app compute for the given app.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="appId">The local app ID.</param>
    /// <returns>A Result containing the app compute status response.</returns>
    Task<Result<AppStatusResponse>> StartAppAsync(Guid userId, Guid tenantId, int appId);

    /// <summary>
    /// Stops the Databricks app compute for the given app.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="appId">The local app ID.</param>
    /// <returns>A Result containing the app compute status response.</returns>
    Task<Result<AppStatusResponse>> StopAppAsync(Guid userId, Guid tenantId, int appId);

    /// <summary>
    /// Replaces the Databricks app's resources array (full list) with optimistic concurrency on <paramref name="request"/>.ExpectedUpdateTime.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="appId">The local app ID.</param>
    /// <param name="request">Resources payload and expected <c>update_time</c> from the client.</param>
    /// <returns>Updated app settings and new <c>update_time</c> from Databricks.</returns>
    Task<Result<UpdateAppResourcesResponseDto>> UpdateAppResourcesAsync(Guid userId, Guid tenantId, int appId, UpdateAppResourcesRequestDto request);

    /// <summary>
    /// Lists Databricks app names for a workspace connection (full pagination), sorted case-insensitively.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="tenantId">The authenticated tenant ID.</param>
    /// <param name="appId">The local VDAB app ID.</param>
    /// <param name="workspaceConnectionId">The selected Databricks workspace connection.</param>
    /// <returns>App names only.</returns>
    Task<Result<DatabricksAppNamesResponseDto>> ListDatabricksAppNamesAsync(
        Guid userId,
        Guid tenantId,
        int appId,
        int workspaceConnectionId);

    /// <summary>
    /// Lists Databricks app names for a workspace connection without a local VDAB app (full pagination), sorted case-insensitively.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="tenantId">The authenticated tenant ID.</param>
    /// <param name="workspaceConnectionId">The selected Databricks workspace connection.</param>
    /// <returns>App names only.</returns>
    Task<Result<DatabricksAppNamesResponseDto>> ListDatabricksAppNamesForWorkspaceAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId);

    /// <summary>
    /// Creates a Databricks app in the given workspace connection. Does not create or update a VDAB app record.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="tenantId">The authenticated tenant ID.</param>
    /// <param name="request">Workspace connection and Databricks create payload.</param>
    /// <returns>Canonical app name and key fields from Databricks.</returns>
    Task<Result<CreatedDatabricksAppDto>> CreateDatabricksAppAsync(
        Guid userId,
        Guid tenantId,
        CreateDatabricksAppRequestDto request);
}
