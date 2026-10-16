using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AppComponent;
using Xorbix_Visual_Databricks_App_Builder.Server;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;
using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.RequireTenantMembership)]
[Route("api/[controller]")]
public class AppComponentController(IAppComponentService componentService, ILogger<AppComponentController> logger)
    : AuthenticatedControllerBase
{
    private readonly IAppComponentService _componentService = componentService;
    private readonly ILogger<AppComponentController> _logger = logger;

    [HttpGet("app/{appId}")]
    public async Task<IActionResult> GetByAppId(int appId)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Requesting components by context for app ID: {AppId}", appId);
        Result<Dictionary<string, List<AppComponentDto>>> result =
            await _componentService.GetComponentsByContextAsync(appId, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpPost("upsert")]
    public async Task<IActionResult> Upsert([FromQuery] int appId, [FromBody] UpsertAppComponentRequest request)
    {
        if (request == null)
            return BadRequest("Request cannot be null.");

        if (appId <= 0)
            return BadRequest("AppId must be greater than 0.");

        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Upserting component of type {ComponentType} for app ID: {AppId}", request.ComponentType, appId);
        Result<AppComponentDto> result = await _componentService.UpsertAppComponentAsync(appId, request, userId, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpPost("upsert-batch")]
    public async Task<IActionResult> UpsertBatch([FromBody] UpsertBatchRequest request)
    {
        if (request == null)
            return BadRequest("Request cannot be null.");

        if (request.AppId <= 0)
            return BadRequest("AppId must be greater than 0.");

        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Upserting {Count} components for app ID: {AppId}", request.Components.Count(), request.AppId);
        Result<IEnumerable<AppComponentDto>> result =
            await _componentService.UpsertAppComponentsBatchAsync(request.AppId, request.Components, userId, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Deleting component ID: {Id}", id);
        Result result = await _componentService.DeleteAppComponentAsync(id, userId, tenantId);
        return this.HandleFluentResult(result);
    }
}
