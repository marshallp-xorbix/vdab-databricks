

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides audit archive support.
/// </summary>
public interface IAuditArchivalService
{
    /// <summary>
    /// Archives old audit records for a specific tenant, year, and month.
    /// </summary>
    /// <param name="tenantId">The tenant ID.</param>
    /// <param name="year">The year of the records to archive.</param>
    /// <param name="month">The month of the records to archive.</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>A task representing the asynchronous operation.</returns>
    Task ArchiveOldRecordsAsync(Guid tenantId, int year, int month, CancellationToken cancellationToken = default);


    /// <summary>
    /// Retrieves archived audit logs for a specific tenant, year, and month.
    /// </summary>
    /// <param name="tenantId">The tenant ID.</param>
    /// <param name="year">The year of the records to retrieve.</param>
    /// <param name="month">The month of the records to retrieve.</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>A task representing the asynchronous operation, with a result of the archived logs as a JSON string, or null if not found.</returns>
    Task<string?> GetArchivedLogsAsync(Guid tenantId, int year, int month, CancellationToken cancellationToken = default);
}
