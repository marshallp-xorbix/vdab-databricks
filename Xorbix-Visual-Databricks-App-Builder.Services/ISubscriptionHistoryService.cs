using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for reading tenant subscription history records.
/// </summary>
public interface ISubscriptionHistoryService
{
    /// <summary>
    /// Retrieves the subscription history for a tenant, newest event first.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A list of subscription history DTOs, or a failure result if the tenant is not found.</returns>
    Task<Result<IReadOnlyList<SubscriptionHistoryDto>>> GetSubscriptionHistoryAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
