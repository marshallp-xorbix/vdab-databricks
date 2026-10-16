using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Provides data access operations for tenant entities.
/// </summary>
public interface ITenantRepository
{
    /// <summary>
    /// Retrieves a tenant by its unique identifier.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The <see cref="Tenant"/> if found; otherwise <c>null</c>.</returns>
    Task<Tenant?> GetByIdAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a tenant for update within the current scoped DbContext.
    /// Returns an already-tracked instance when present; otherwise loads with tracking.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The tracked <see cref="Tenant"/> if found; otherwise <c>null</c>.</returns>
    Task<Tenant?> GetByIdForUpdateAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a tenant by its unique name.
    /// </summary>
    /// <param name="tenantName">The tenant's unique name.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The <see cref="Tenant"/> if found; otherwise <c>null</c>.</returns>
    Task<Tenant?> GetByNameAsync(string tenantName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a tenant by Stripe customer identifier.
    /// </summary>
    /// <param name="billingCustomerId">Stripe customer identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The <see cref="Tenant"/> if found; otherwise <c>null</c>.</returns>
    Task<Tenant?> GetByBillingCustomerIdAsync(string billingCustomerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a tenant by Stripe subscription identifier.
    /// </summary>
    /// <param name="stripeSubscriptionId">Stripe subscription identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The <see cref="Tenant"/> if found; otherwise <c>null</c>.</returns>
    Task<Tenant?> GetByStripeSubscriptionIdAsync(string stripeSubscriptionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new tenant in the data store.
    /// </summary>
    /// <param name="tenant">The tenant entity to create.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The created tenant with generated identity fields.</returns>
    Task<Tenant> CreateAsync(Tenant tenant, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an existing tenant in the data store.
    /// </summary>
    /// <param name="tenant">The tenant entity with updated values.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    Task UpdateAsync(Tenant tenant, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves usage statistics for a tenant including user count, app count,
    /// and connection count along with subscription limits.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A <see cref="TenantUsageStatsDto"/> if the tenant exists; otherwise <c>null</c>.</returns>
    Task<TenantUsageStatsDto?> GetUsageStatsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a paginated list of all active (non-deleted) tenants.
    /// </summary>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A tuple of the tenant DTO list and the total count of tenants.</returns>
    Task<(List<TenantDto> Tenants, int TotalCount)> GetAllForManagementAsync(int skip, int take, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a paginated list of tenant entities.
    /// </summary>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A tuple of tenant entities and the total count of tenants.</returns>
    Task<(List<Tenant> Tenants, int TotalCount)> GetAllAsync(int skip, int take, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets the <c>IsActive</c> flag for a tenant and updates audit fields.
    /// </summary>
    Task<bool> SetActiveAsync(Guid tenantId, bool isActive, Guid modifiedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Soft-deletes a tenant by stamping <c>DeletedOn</c>/<c>DeletedBy</c> and marking it inactive.
    /// </summary>
    Task<bool> SoftDeleteAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently removes the tenant row.
    /// </summary>
    Task<bool> HardDeleteAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// True when the user is <c>OwnerId</c> of any non-deleted tenant.
    /// </summary>
    Task<bool> IsOwnerOfAnyTenantAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Clears <c>OwnerId</c> on every tenant currently owned by the given user (no FK; soft reference).
    /// </summary>
    Task<int> ClearOwnerIdForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts active (non-deleted, <c>IsActive == true</c>) tenants.
    /// </summary>
    Task<int> CountActiveTenantsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts tenants created on or after the supplied UTC timestamp (non-deleted).
    /// </summary>
    Task<int> CountTenantsCreatedSinceAsync(DateTime sinceUtc, CancellationToken cancellationToken = default);
}
