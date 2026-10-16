using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.RequireTenantMembership)]
[Route("api/[controller]")]
public class DatabricksConnectionController(
    IDatabricksConnectionService connectorService,
    IDatabricksConnectionImportExportService importExportService,
    ILogger<DatabricksConnectionController> logger) : AuthenticatedControllerBase
{
    private readonly IDatabricksConnectionService _connectorService = connectorService;
    private readonly ILogger<DatabricksConnectionController> _logger = logger;
    private readonly IDatabricksConnectionImportExportService _importExportService = importExportService;

    [HttpGet("tenant")]
    public async Task<ActionResult<IEnumerable<DatabricksConnectionDto>>> GetByTenant()
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Requesting connections for tenant ID: {TenantId}", tenantId);
        Result<IEnumerable<DatabricksConnectionDto>> result = await _connectorService.GetConnectionsByTenantIdAsync(tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpGet("{workspaceUrl}")]
    public async Task<ActionResult<DatabricksConnectionDto?>> Get(string workspaceUrl)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("API: Requesting connection for workspace: {WorkspaceUrl}", workspaceUrl);
        Result<DatabricksConnectionDto?> result = await _connectorService.GetConnectionByWorkspaceAsync(workspaceUrl, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpPost]
    public async Task<ActionResult<DatabricksConnectionDto>> Create([FromBody] CreateDatabricksConnectionRequest request)
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

        _logger.LogInformation(
            "API: Creating Databricks connection for workspace {WorkspaceUrl} in tenant {TenantId}",
            request.WorkspaceUrl,
            tenantId);
        Result<DatabricksConnectionDto> result = await _connectorService.CreateConnectionAsync(request, ownerId, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<DatabricksConnectionDto>> Update(int id, [FromBody] UpdateDatabricksConnectionRequest request)
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

        _logger.LogInformation("API: Updating Databricks connection {ConnectionId}", id);
        Result<DatabricksConnectionDto> result = await _connectorService.UpdateConnectionAsync(id, request, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpPost("UpdateWorkspaceRefreshToken")]
    public async Task<IActionResult> UpdateWorkspaceRefreshToken([FromBody] UpdateWorkspaceRefreshTokenRequest request)
    {
        if (request == null || request.WorkspaceConnectionId <= 0 || string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest("WorkspaceConnectionId and RefreshToken are required.");
        }

        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation(
            "API: Updating refresh token for user {UserId} and workspace connection {WorkspaceConnectionId}",
            userId,
            request.WorkspaceConnectionId);
        Result result = await _connectorService.AddRefreshTokenAsync(
            userId, request.WorkspaceConnectionId, request.RefreshToken, request.ExpiresAt, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpGet("tenant/status")]
    public async Task<IActionResult> GetByTenantWithStatus()
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation(
            "API: Requesting connections with auth status for tenant {TenantId}, user {UserId}",
            tenantId,
            userId);

        Result<IEnumerable<DatabricksConnectionStatusDto>> result =
            await _connectorService.GetConnectionsWithAuthStatusAsync(tenantId, userId);
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

        _logger.LogInformation("API: Deleting connection ID: {Id}", id);
        bool isTenantAdmin = string.Equals(AuthenticatedTenantRole, AuthRoles.TenantAdmin, StringComparison.OrdinalIgnoreCase);
        Result result = await _connectorService.DeleteConnectionAsync(id, tenantId, userId, isTenantAdmin);
        return this.HandleFluentResult(result);
    }

    [HttpPost("{workspaceConnectionId}/disconnect")]
    public async Task<IActionResult> Disconnect(int workspaceConnectionId)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation(
            "API: Disconnecting user {UserId} from workspace {WorkspaceConnectionId}",
            userId,
            workspaceConnectionId);
        Result result = await _connectorService.DisconnectWorkspaceAsync(userId, workspaceConnectionId, tenantId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Exports every Databricks connection in the authenticated global administrator's tenant.
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

        _logger.LogInformation("API: Exporting all connections for tenant {TenantId}", tenantId);
        Result<ExportBundleDto> result = await _importExportService.ExportConnectionsByTenantAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Exports a single Databricks connection for the authenticated global administrator.
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

        _logger.LogInformation("API: Exporting connection {ConnectionId} for tenant {TenantId}", id, tenantId);
        Result<ExportBundleDto> result = await _importExportService.ExportConnectionAsync(id, tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Imports a single Databricks connection into the authenticated global administrator's tenant.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("import")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ImportElementResultDto>> Import([FromBody] ImportConnectionRequest request, CancellationToken cancellationToken)
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

        _logger.LogInformation("API: Importing connection into tenant {TenantId}", tenantId);
        Result<ImportElementResultDto> result = await _importExportService.ImportConnectionAsync(request, tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }
}
