using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for subscription history persistence.
/// </summary>
public interface ISubscriptionHistoryRepository
{
    /// <summary>
    /// Adds a subscription history record.
    /// </summary>
    /// <param name="record">History record to persist.</param>
    Task AddAsync(SubscriptionHistory record);

    /// <summary>
    /// Retrieves all subscription history records for a tenant, newest event first.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The tenant's subscription history records ordered by event date descending.</returns>
    Task<IReadOnlyList<SubscriptionHistory>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Permanently removes every subscription history row for the given tenant.</summary>
    Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
