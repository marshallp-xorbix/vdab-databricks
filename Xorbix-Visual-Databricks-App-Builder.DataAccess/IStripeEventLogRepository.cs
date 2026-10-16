using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository interface for Stripe event logging and idempotency checks.
/// </summary>
public interface IStripeEventLogRepository
{
    /// <summary>
    /// Checks whether a Stripe event has already been logged.
    /// </summary>
    /// <param name="stripeEventId">The Stripe event identifier.</param>
    /// <returns>True when the event already exists; otherwise false.</returns>
    Task<bool> ExistsAsync(string stripeEventId);

    /// <summary>
    /// Adds a Stripe event log entry.
    /// </summary>
    /// <param name="log">The log entry to persist.</param>
    Task AddAsync(StripeEventLog log);

    /// <summary>
    /// Retrieves a paginated set of recent Stripe event log entries.
    /// </summary>
    /// <param name="pageNumber">The 1-based page number to retrieve.</param>
    /// <param name="pageSize">The number of records per page.</param>
    /// <returns>A descending list of recent Stripe events.</returns>
    Task<List<StripeEventLog>> GetRecentAsync(int pageNumber, int pageSize);

    /// <summary>
    /// Retrieves a paginated set of recent Stripe event log entries and the total row count.
    /// </summary>
    /// <param name="pageNumber">The 1-based page number to retrieve.</param>
    /// <param name="pageSize">The number of records per page.</param>
    /// <returns>The paginated logs and total number of Stripe event logs.</returns>
    Task<(List<StripeEventLog> Logs, int TotalCount)> GetRecentWithCountAsync(int pageNumber, int pageSize);

    /// <summary>
    /// Permanently removes every Stripe event log row for the given Stripe customer id.
    /// </summary>
    Task<int> HardDeleteByCustomerIdAsync(string customerId, CancellationToken cancellationToken = default);
}