using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;
using Xorbix_Visual_Databricks_App_Builder.Server;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.RequireTenantMembership)]
[Route("api/[controller]")]
public class AppController(IAppService appService, IAppImportExportService importExportService, ILogger<AppController> logger) : AuthenticatedControllerBase
{
    private readonly IAppService _appService = appService;
    private readonly IAppImportExportService _importExportService = importExportService;
    private readonly ILogger<AppController> _logger = logger;

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Requesting app by ID: {Id} for tenant {TenantId}", id, tenantId);
        Result<AppDto?> result = await _appService.GetAppByIdAsync(id, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpGet("tenant")]
    public async Task<IActionResult> GetByTenant()
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Requesting apps for tenant ID: {TenantId}", tenantId);
        Result<IEnumerable<AppDto>> result = await _appService.GetAppsByTenantIdAsync(tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAppRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request cannot be null.");
        }

        ActionResult? authFailure = RequireAuthenticatedContext(out Guid ownerId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Creating app: {AppName}", request.AppName);
        Result<AppDto> result = await _appService.CreateAppAsync(request, ownerId, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAppRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Updating app ID: {Id}", id);
        Result result = await _appService.UpdateAppAsync(id, request, userId, tenantId);
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

        _logger.LogInformation("API: Deleting app ID: {Id}", id);
        bool isTenantAdmin = string.Equals(AuthenticatedTenantRole, AuthRoles.TenantAdmin, StringComparison.OrdinalIgnoreCase);
        Result result = await _appService.DeleteAppAsync(id, tenantId, userId, isTenantAdmin);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Exports every app in the authenticated global administrator's tenant.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet("export")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ExportBundleDto>> ExportAll(CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Exporting all apps for tenant {TenantId}", tenantId);
        Result<ExportBundleDto> result = await _importExportService.ExportAppsByTenantAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Exports a single app (including its components) for the authenticated global administrator.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet("{id:int}/export")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ExportBundleDto>> ExportOne(int id, CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Exporting app {AppId} for tenant {TenantId}", id, tenantId);
        Result<ExportBundleDto> result = await _importExportService.ExportAppAsync(id, tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Imports a single app into the authenticated global administrator's tenant.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("import")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ImportElementResultDto>> Import([FromBody] ImportAppRequest request, CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest("Request cannot be null.");
        }

        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Importing app into tenant {TenantId}", tenantId);
        Result<ImportElementResultDto> result = await _importExportService.ImportAppAsync(request, tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }
}
