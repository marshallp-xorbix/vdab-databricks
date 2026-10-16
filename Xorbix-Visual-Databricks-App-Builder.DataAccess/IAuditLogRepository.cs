
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    /// <summary>
    /// Provides data access operations for App components.
    /// </summary>
    public interface IAuditLogRepository
    {
        /// <summary>
        /// Adds a new AuditLog to the data store
        /// </summary>
        /// <param name="auditLog">The auditlog to add.</param>
        Task LogAsync(AuditLog auditLog);

        /// <summary>
        /// Runs a filter-aware keyset-paginated query against the audit log, projecting joined
        /// user and tenant display info in a single database round trip.
        /// </summary>
        /// <param name="query">Filter + pagination criteria.</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns>
        /// Projected page of audit log DTOs (size at most <c>query.Take</c>) and an optional
        /// next-page cursor. <c>NextCursor</c> is null when there are no further entries.
        /// </returns>
        Task<(IReadOnlyList<AuditLogDto> Items, AuditLogCursor? NextCursor)> QueryAsync(AuditLogQuery query, CancellationToken cancellationToken);

        /// <summary>
        /// Retrieves the AuditLog based on its tenant (paginated).
        /// </summary>
        /// <param name="tenant">The tenant of the auditlog to retrieve.</param>
        /// <param name="skip">Number of records to skip.</param>
        /// <param name="take">Number of records to return.</param>
        /// <returns>
        /// The <see cref="AuditLog"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<List<AuditLog>> GetByTenantAsync(Tenant? tenant, int skip, int take);

        /// <summary>
        /// Retrieves the AuditLog based on its tenant (paginated, filtered by date range).
        /// </summary>
        /// <param name="tenant">The tenant of the auditlog to retrieve.</param>
        /// <param name="startDate">The earliest date of the auditlog to retrieve.</param>
        /// <param name="endDate">The latest date of the auditlog to retrieve.</param>
        /// <param name="skip">Number of records to skip.</param>
        /// <param name="take">Number of records to return.</param>
        /// <returns>
        /// The <see cref="AuditLog"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<List<AuditLog>> GetByTenantOnRangeAsync(Tenant? tenant, DateTime startDate, DateTime endDate, int skip, int take);

        /// <summary>
        ///  Retrieves the AuditLog based on its userId
        /// </summary>
        /// <param name="userId">The ID of the auditlog to retrieve.</param>
        /// <param name="skip">Number of records to skip.</param>
        /// <param name="take">Number of records to return.</param>
        /// <returns>
        /// The <see cref="AuditLog"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<List<AuditLog>> GetByUserAsync(Guid? userId, int skip, int take);


        /// <summary>
        ///  Retrieves the AuditLogs
        /// </summary>
        /// <param name="skip">Number of records to skip.</param>
        /// <param name="take">Number of records to return.</param>
        /// <returns>
        /// The <see cref="AuditLog"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<List<AuditLog>> GetAllAuditLogsAsync(int skip, int take);

        /// <summary>
        /// Updates AuditLog given so IsArchived bool is true.
        /// </summary>
        /// <param name="auditLog">The auditlog to update.</param>
        Task MarkArchivedAsync(AuditLog auditLog, CancellationToken token);

        /// <summary>
        ///  Get AuditLogs older than given date
        /// </summary>
        /// <param name="timestamp">The datetime cutoff of auditlogs before a certain date to retrieve.</param>
        /// <param name="skip">Number of records to skip.</param>
        /// <param name="take">Number of records to return.</param>
        /// <returns>
        /// The List of <see cref="AuditLog"/> entities if found; otherwise <c>null</c>.
        /// </returns>
        Task<List<AuditLog>> GetRecordsForArchivalAsync(DateTime start, DateTime end, int skip, int take);

        /// <summary>
        /// Permanently removes every audit log row for the given tenant.
        /// </summary>
        Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Permanently removes every audit log row attributed to the given user.
        /// </summary>
        Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    }
}
