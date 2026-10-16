using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Reports;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides aggregated platform reports for administrators.
/// </summary>
public interface IReportsService
{
    /// <summary>
    /// Returns a snapshot of high-level platform statistics
    /// (user counts, pending invites, app and workspace counts, system health).
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Result<ReportsStatsResponse>> GetStatsAsync(CancellationToken cancellationToken = default);
}
