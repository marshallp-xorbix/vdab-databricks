
using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;
using static System.Net.Mime.MediaTypeNames;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Controller for querying and exporting audit logs.
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AuditController : AuthenticatedControllerBase
{
    private readonly IAuditLogService _auditLogService;
    private readonly IAuditArchivalService _archivalService;
    private readonly ILogger<AuditController> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="AuditController"/> class.
    /// </summary>
    public AuditController(
        IAuditLogService auditLogService,
        IAuditArchivalService archivalService,
        ILogger<AuditController> logger)
    {
        _auditLogService = auditLogService;
        _archivalService = archivalService;
        _logger = logger;
    }

    /// <summary>
    /// Queries audit logs with optional user, tenant, action type, severity, and date filters.
    /// Uses keyset (cursor) pagination — pass <paramref name="cursor"/> from the previous
    /// response's <c>nextCursor</c> field to advance. A null/absent cursor returns the first page.
    /// Access is enforced by the requested scope:
    /// global admins may query anything; tenant admins may query their current tenant
    /// or themselves; everyone else may query only their own activity.
    /// </summary>
    /// <param name="userId">Optional user filter.</param>
    /// <param name="tenantId">Optional tenant filter.</param>
    /// <param name="actionTypes">Optional list of action types.</param>
    /// <param name="severities">Optional list of severity levels.</param>
    /// <param name="startDate">Optional inclusive start timestamp (UTC).</param>
    /// <param name="endDate">Optional inclusive end timestamp (UTC).</param>
    /// <param name="includeArchived">Whether to include archived entries (default false).</param>
    /// <param name="cursor">Opaque cursor from the prior page's <c>nextCursor</c>. Omit for first page.</param>
    /// <param name="take">Number of records to return (default 25, max 200).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paginated audit log entries with an opaque next-page cursor.</returns>
    [HttpGet("logs")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<PaginatedAuditLogsResponse>> GetAuditLogs(
        [FromQuery] Guid? userId,
        [FromQuery] Guid? tenantId,
        [FromQuery] string[]? actionTypes,
        [FromQuery] string[]? severities,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] bool includeArchived,
        [FromQuery] string? cursor,
        [FromQuery] int take,
        CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid callerUserId);
        if (authFailure is not null)
            return authFailure;

        Result<(Guid? UserId, Guid? TenantId)> scope = ResolveScopeForCaller(userId, tenantId, callerUserId);
        if (scope.IsFailed)
            return this.HandleFluentResult(scope.ToResult());

        // Decode the opaque cursor at the boundary. An explicitly-supplied but invalid
        // cursor is a client error — don't silently fall through to "first page".
        AuditLogCursor? parsedCursor = null;
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            parsedCursor = AuditLogCursor.TryDecode(cursor);
            if (parsedCursor is null)
            {
                return this.HandleFluentResult(
                    Result.Fail(new BadRequestError("Invalid cursor.")));
            }
        }

        AuditLogQuery query = new()
        {
            UserId = scope.Value.UserId,
            TenantId = scope.Value.TenantId,
            ActionTypes = actionTypes is { Length: > 0 } ? actionTypes : null,
            Severities = severities is { Length: > 0 } ? severities : null,
            StartDate = startDate,
            EndDate = endDate,
            IncludeArchived = includeArchived,
            Cursor = parsedCursor,
            Take = take,
        };

        _logger.LogInformation(
            "User {UserId} querying audit logs (scope user={ScopeUserId}, scope tenant={ScopeTenantId}, take={Take}, hasCursor={HasCursor})",
            callerUserId, query.UserId, query.TenantId, query.Take, parsedCursor is not null);

        Result<PaginatedAuditLogsResponse> result = await _auditLogService.QueryAsync(query, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Determines which filters the caller is allowed to apply and returns the resolved
    /// (UserId, TenantId) pair, or a Forbidden / BadRequest result if the request exceeds
    /// the caller's permissions.
    /// </summary>
    private Result<(Guid? UserId, Guid? TenantId)> ResolveScopeForCaller(
        Guid? requestedUserId,
        Guid? requestedTenantId,
        Guid callerUserId)
    {
        // Global admins can query anything, including unscoped (everything).
        if (User.IsInRole(AuthRoles.Administrator))
            return Result.Ok<(Guid?, Guid?)>((requestedUserId, requestedTenantId));

        bool hasElevatedTenantRole = User.IsInRole(AuthRoles.TenantAdmin);

        // Self-scoped query (userId == caller, no tenant override or tenant matches current).
        if (requestedUserId == callerUserId &&
            (requestedTenantId is null || requestedTenantId == AuthenticatedTenantId))
        {
            return Result.Ok<(Guid?, Guid?)>((callerUserId, requestedTenantId));
        }

        // Tenant-scoped query — only allowed for tenant admins of that exact tenant.
        if (hasElevatedTenantRole &&
            requestedTenantId is Guid scopedTenantId &&
            scopedTenantId == AuthenticatedTenantId)
        {
            return Result.Ok<(Guid?, Guid?)>((requestedUserId, scopedTenantId));
        }

        return Result.Fail<(Guid?, Guid?)>(new ForbiddenError("Not authorized to query audit logs for the requested scope."));
    }

    /// <summary>
    /// Gets archived audit logs for a tenant the caller is permitted to access.
    /// </summary>
    /// <param name="tenantId">Optional tenant filter; defaults to the caller's current tenant.</param>
    /// <param name="year">The year of the audit logs to retrieve.</param>
    /// <param name="month">The month of the audit logs to retrieve.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>Archived audit logs JSON payload.</returns>
    [HttpGet("archived")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult> getArchivedAuditLogs(
        [FromQuery] Guid? tenantId,
        int year,
        int month,
        CancellationToken token)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid callerUserId);
        if (authFailure is not null)
            return authFailure;

        Guid? effectiveTenantId = tenantId ?? AuthenticatedTenantId;
        Result<(Guid? UserId, Guid? TenantId)> scope = ResolveScopeForCaller(null, effectiveTenantId, callerUserId);
        if (scope.IsFailed)
            return this.HandleFluentResult(scope.ToResult());

        if (scope.Value.TenantId is not Guid resolvedTenantId)
        {
            return this.HandleFluentResult(
                Result.Fail(new BadRequestError("Tenant ID is required for archived audit log retrieval.")));
        }

        _logger.LogInformation(
            "User {UserId} retrieving archived audit logs for tenant {TenantId}, year {Year}, month {Month}",
            callerUserId, resolvedTenantId, year, month);

        string? result = await _archivalService.GetArchivedLogsAsync(resolvedTenantId, year, month, token);

        if (result == null)
            return NotFound();
        return Content(result, "application/json");
    }

    /// <summary>
    /// Marks audit logs as archived
    /// </summary>
    /// <param name="tenant">The tenant of the audit logs to archive.</param>
    /// <param name="start">The earliest date of the audit logs to retrieve.</param> //NOTE: ASSUMES MONTH AND YEAR OF START AND END ARE THE SAME
    /// <param name="end">The latest date of the audit logs to retrieve.</param>
    /// <param name="skip">Number of records to skip (default 0).</param>
    /// <param name="take">Number of records to return (default 25).</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>returns list of just archived audit logs</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("archive")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<List<AuditLog>>> archiveAuditLogs(
        Tenant tenant,
        DateTime start, 
        DateTime end,
        CancellationToken token, 
        [FromQuery] int skip = 0, 
        [FromQuery] int take = 25)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {UserId} archiving audit logs for tenant {TenantId}", userId, tenant.TenantId);
        var result = await _auditLogService.GetAuditLogsForArchival(start, end, skip, take, token);

        _logger.LogInformation("Archiving audit logs");
        await _archivalService.ArchiveOldRecordsAsync(tenant.TenantId, start.Year, start.Month, token);

        _logger.LogInformation("Successfully archived audit logs");
        return Ok(new { message = "Archival complete." });
    }
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("archive-blob")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> ArchiveAuditLogsToBlob(
    [FromQuery] Guid tenantId,
    [FromQuery] int year,
    [FromQuery] int month,
    CancellationToken token)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "Administrator {UserId} archiving audit logs to blob for tenant {TenantId}, year {Year}, month {Month}",
            userId, tenantId, year, month);
        await _archivalService.ArchiveOldRecordsAsync(tenantId, year, month, token);
        return Ok(new { message = "Archival complete." });
    }

    /// <summary>
    /// Exports scoped audit logs to CSV or JSON using the same access rules as <see cref="GetAuditLogs"/>.
    /// </summary>
    /// <param name="fileType">Export format: <c>json</c> or <c>csv</c>.</param>
    /// <param name="userId">Optional user filter.</param>
    /// <param name="tenantId">Optional tenant filter.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <param name="take">Number of records to export (default 25, max 200).</param>
    /// <returns>File download of audit logs in the requested format.</returns>
    [HttpGet("logs/export")]
    [Produces(MediaTypeNames.Application.Json, "text/csv")]
    public async Task<IActionResult> exportAuditLogs(
        string fileType,
        CancellationToken token,
        [FromQuery] Guid? userId,
        [FromQuery] Guid? tenantId,
        [FromQuery] int take = 25)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid callerUserId);
        if (authFailure is not null)
            return authFailure;

        Result<(Guid? UserId, Guid? TenantId)> scope = ResolveScopeForCaller(userId, tenantId, callerUserId);
        if (scope.IsFailed)
            return this.HandleFluentResult(scope.ToResult());

        AuditLogQuery query = new()
        {
            UserId = scope.Value.UserId,
            TenantId = scope.Value.TenantId,
            Take = take,
        };

        _logger.LogInformation(
            "User {UserId} exporting audit logs as {FileType} (scope user={ScopeUserId}, scope tenant={ScopeTenantId}, take={Take})",
            callerUserId, fileType, query.UserId, query.TenantId, query.Take);

        Result<PaginatedAuditLogsResponse> queryResult = await _auditLogService.QueryAsync(query, token);
        if (queryResult.IsFailed)
            return this.HandleFluentResult(queryResult);

        List<AuditLog> auditLogs = queryResult.Value.Items.Select(MapToAuditLogEntity).ToList();

        if (fileType.Equals("json", StringComparison.OrdinalIgnoreCase))
        {
            return await _auditLogService.exportAuditLogsToJson(auditLogs, token);
        }

        if (fileType.Equals("csv", StringComparison.OrdinalIgnoreCase))
        {
            return await _auditLogService.exportAuditLogsToCsv(auditLogs, token);
        }

        return this.HandleFluentResult(Result.Fail(new BadRequestError("fileType must be 'json' or 'csv'.")));
    }

    private static AuditLog MapToAuditLogEntity(AuditLogDto dto) => new()
    {
        AuditLogId = dto.AuditLogId,
        TenantId = dto.TenantId,
        UserId = dto.UserId,
        IsArchived = dto.IsArchived,
        ActionType = dto.ActionType,
        EntityType = dto.EntityType,
        EntityId = dto.EntityId,
        HistoricalEntityId = dto.EntityId,
        Description = dto.Description,
        Metadata = dto.Metadata,
        IpAddress = dto.IpAddress,
        UserAgent = dto.UserAgent,
        Severity = dto.Severity,
        Timestamp = dto.Timestamp,
    };
}
