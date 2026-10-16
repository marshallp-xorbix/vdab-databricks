using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides Stripe event log retrieval for diagnostics.
/// </summary>
public interface IStripeEventLogService
{
    /// <summary>
    /// Retrieves paginated Stripe event logs with total count.
    /// </summary>
    /// <param name="pageNumber">Requested 1-based page number.</param>
    /// <param name="pageSize">Requested page size.</param>
    /// <param name="cancellationToken">Cancellation token for the read operation.</param>
    /// <returns>Paginated Stripe event logs response.</returns>
    Task<Result<PaginatedStripeEventLogsResponse>> GetRecentAsync(int pageNumber, int pageSize, CancellationToken cancellationToken = default);
}