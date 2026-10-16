using FluentResults; // Need this using statement
using MaxMind.Db;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public interface IAuditLogService
{
    /// <summary>
    /// Logs new AuditLog Action
    /// </summary>
    /// <param name="ipAddress"> IP Address to log with audit log.</param>
    /// <param name="userAgent">user agent to log with audit log.</param>
    /// <param name="actionType">Action Type to log with audit log.</param>
    /// <param name="tenantId">Tenant to log with audit log.</param>
    /// <param name="userId">User ID to log with audit log.</param>
    /// <param name="entityType">Entity Type to log with audit log.</param>
    /// <param name="entityId">Entity ID to log with audit log (max 100 characters).</param>
    /// <param name="severity">Severity to log with audit log.</param>
    /// <param name="metadata">Optional JSON metadata stored on the audit row (unbounded text).</param>
    /// <returns>A Result indicating success or failure. </returns>
    Task<Result> LogActionAsync(
        string ipAddress,
        string userAgent,
        string actionType,
        Guid? tenantId,
        Guid? userId,
        string? entityType,
        string? entityId,
        string severity,
        string? metadata = null);

    /// <summary>
    /// Runs a filter-aware paginated query against the audit log. Replaces the
    /// scattered <c>GetBy*</c> methods for any caller that needs server-side
    /// filtering + pagination and a client-safe DTO shape.
    /// </summary>
    /// <param name="query">Filter + pagination criteria.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paginated response with projected audit log entries.</returns>
    Task<Result<PaginatedAuditLogsResponse>> QueryAsync(AuditLogQuery query, CancellationToken cancellationToken);

    /// <summary>
    /// Retrieves the AuditLogs by tenant
    /// </summary>
    /// <param name="tenant">The tenant of the auditlog to retrieve.</param>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>A Result containing a list of AuditLogs if found, otherwise an empty list. </returns>
    Task<Result<List<AuditLog>>> GetAuditLogsByTenantAsync(Tenant? tenant, int skip, int take, CancellationToken token);

    /// <summary>
    /// Retrieves the AuditLogs by tenant in range
    /// </summary>
    /// <param name="tenant">The tenant of the auditlog to retrieve.</param>
    /// <param name="startDate">The earliest date of the auditlog to retrieve.</param>
    /// <param name="endDate">The latest date of the auditlog to retrieve.</param>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>A Result containing a list of AuditLogs if found, otherwise an empty list. </returns>
    Task<Result<List<AuditLog>>> GetAuditLogsByTenantOnRangeAsync(Tenant? tenant, DateTime startDate, DateTime endDate, int skip, int take, CancellationToken token);

    /// <summary>
    /// Retrieves the AuditLogs by userId
    /// </summary>
    /// <param name="userId">The ID of the auditlog to retrieve.</param>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>A Result containing a list of AuditLogs if found, otherwise an empty list. </returns>
    Task<Result<List<AuditLog>>> GetAuditLogsByUserAsync(Guid? userId, int skip, int take, CancellationToken token);

    /// <summary>
    /// Retrieves the AuditLogs
    /// </summary>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>A Result containing a list of AuditLogs if found, otherwise an empty list. </returns>
    Task<Result<List<AuditLog>>> GetAllAuditLogsAsync(int skip, int take, CancellationToken token);

    /// <summary>
    /// Retrieves the User's Activity (action types?)
    /// </summary>
    /// <param name="userId">The ID of the auditlog to retrieve.</param>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>A Result containing a list of action types (user activity?) if found, outherwise an empty list. </returns>
    Task<Result<List<string>>> GetUserActivityAsync(Guid? userId, int skip, int take, CancellationToken token);

    /// <summary>
    /// Marks AuditLog as archived
    /// </summary>
    /// <param name="auditLogs">Audit log to be archived.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>A Result indicating success or failure. </returns>
    Task<Result> ArchiveAuditLogsAsync(List<AuditLog> auditLogs, CancellationToken token);

    /// <summary>
    /// Retrieves the AuditLogs in range for archival
    /// </summary>
    /// <param name="start">The earliest date of the auditlog to retrieve.</param>
    /// <param name="end">The latest date of the auditlog to retrieve.</param>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>A Result containing a list of AuditLogs if found, otherwise an empty list. </returns>
    Task<Result<List<AuditLog>>> GetAuditLogsForArchival(DateTime start, DateTime end, int skip, int take, CancellationToken token);


    /// <summary>
    /// Exports audit logs to CSV
    /// </summary>
    /// <param name="auditLogs">Audit logs to export</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>success response if exported to CSV</returns>
    Task<FileContentResult> exportAuditLogsToCsv(List<AuditLog> auditLogs, CancellationToken token);

    /// <summary>
    /// Exports audit logs to JSON
    /// </summary>
    /// <param name="auditLogs">Audit logs to export</param>
    /// <param name="token">A cancellation token in case a cancellation is requested.</param>
    /// <returns>success response if exported to JSON</returns>
    Task<FileContentResult> exportAuditLogsToJson(List<AuditLog> auditLogs, CancellationToken token);
}
