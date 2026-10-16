using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Server;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.RequireTenantMembership)]
[Route("api/[controller]")]
public class AppActionsController(IAppActionService appActionService, ILogger<AppActionsController> logger)
    : AuthenticatedControllerBase
{
    private readonly IAppActionService _appActionService = appActionService;
    private readonly ILogger<AppActionsController> _logger = logger;

    [HttpGet("{appId}/" + AppActionApiRoutes.Status)]
    public async Task<IActionResult> GetStatus(int appId)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Requesting app status for ID: {AppId}, User: {UserId}", appId, userId);
        Result<AppStatusResponse> result = await _appActionService.GetAppStatusAsync(userId, tenantId, appId);
        return this.HandleFluentResult(result);
    }

    [HttpGet("{appId}/" + AppActionApiRoutes.Details)]
    public async Task<IActionResult> GetDetails(int appId)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Requesting app details for ID: {AppId}, User: {UserId}", appId, userId);
        Result<DatabricksAppResponse> result = await _appActionService.GetAppDetailsAsync(userId, tenantId, appId);
        return this.HandleFluentResult(result);
    }

    [HttpPut("{appId}/" + AppActionApiRoutes.Resources)]
    public async Task<IActionResult> UpdateResources(int appId, [FromBody] UpdateAppResourcesRequestDto request)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Updating app resources for ID: {AppId}, User: {UserId}", appId, userId);
        Result<UpdateAppResourcesResponseDto> result = await _appActionService.UpdateAppResourcesAsync(userId, tenantId, appId, request);
        return this.HandleFluentResult(result);
    }

    [HttpPost("{appId}/" + AppActionApiRoutes.Start)]
    public async Task<IActionResult> Start(int appId)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Starting app for ID: {AppId}, User: {UserId}", appId, userId);
        Result<AppStatusResponse> result = await _appActionService.StartAppAsync(userId, tenantId, appId);
        return this.HandleFluentResult(result);
    }

    [HttpPost("{appId}/" + AppActionApiRoutes.Stop)]
    public async Task<IActionResult> Stop(int appId)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Stopping app for ID: {AppId}, User: {UserId}", appId, userId);
        Result<AppStatusResponse> result = await _appActionService.StopAppAsync(userId, tenantId, appId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Lists Databricks app names for a workspace connection (no local VDAB app required).
    /// </summary>
    [HttpGet(AppActionApiRoutes.DatabricksAppNames)]
    public async Task<IActionResult> ListDatabricksAppNamesForWorkspace([FromQuery] int workspaceConnectionId)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation(
            "API: Listing Databricks app names for workspace only. WorkspaceConnectionId: {WorkspaceConnectionId}, User: {UserId}",
            workspaceConnectionId,
            userId);

        Result<DatabricksAppNamesResponseDto> result =
            await _appActionService.ListDatabricksAppNamesForWorkspaceAsync(userId, tenantId, workspaceConnectionId);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Creates a Databricks app in the workspace for the given connection. Does not create a VDAB app record.
    /// </summary>
    [HttpPost(AppActionApiRoutes.DatabricksApps)]
    public async Task<IActionResult> CreateDatabricksApp([FromBody] CreateDatabricksAppRequestDto request)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation(
            "API: Creating Databricks app in workspace. WorkspaceConnectionId: {WorkspaceConnectionId}, User: {UserId}",
            request.WorkspaceConnectionId,
            userId);

        Result<CreatedDatabricksAppDto> result = await _appActionService.CreateDatabricksAppAsync(userId, tenantId, request);
        return this.HandleFluentResult(result);
    }

    [HttpGet("{appId}/" + AppActionApiRoutes.DatabricksAppNames)]
    public async Task<IActionResult> ListDatabricksAppNames(int appId, [FromQuery] int workspaceConnectionId)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation(
            "API: Listing Databricks app names for AppId: {AppId}, WorkspaceConnectionId: {WorkspaceConnectionId}, User: {UserId}",
            appId,
            workspaceConnectionId,
            userId);

        Result<DatabricksAppNamesResponseDto> result =
            await _appActionService.ListDatabricksAppNamesAsync(userId, tenantId, appId, workspaceConnectionId);

        return this.HandleFluentResult(result);
    }
}
