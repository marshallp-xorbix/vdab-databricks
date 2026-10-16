using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for managing user-tenant membership data access.
/// Handles multi-tenant user memberships with tenant-specific roles.
/// </summary>
public interface IUserTenantMembershipRepository
{
    /// <summary>
    /// Retrieves all live (non-deleted) memberships for a user — Active and Suspended —
    /// with <see cref="UserTenantMembership.Tenant"/> populated.
    /// </summary>
    Task<IEnumerable<UserTenantMembership>> GetLiveByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves all tenant memberships for a specific user.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Collection of the user's tenant memberships with Tenant populated.</returns>
    Task<IEnumerable<UserTenantMembership>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves all user memberships for a specific tenant.
    /// </summary>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Collection of tenant memberships with User populated.</returns>
    Task<IEnumerable<UserTenantMembership>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a specific membership by user and tenant.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The membership if found; otherwise null.</returns>
    Task<UserTenantMembership?> GetByUserAndTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves the user's default tenant membership.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The default membership if found; otherwise null.</returns>
    Task<UserTenantMembership?> GetUserDefaultTenantAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves the user's most recently accessed tenant membership.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The most recently accessed membership, or <c>null</c> when no access history exists.</returns>
    Task<UserTenantMembership?> GetUserLastAccessedTenantAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates the LastAccessedAt timestamp for a membership.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>True if successful; false if the membership doesn't exist.</returns>
    Task<bool> UpdateLastAccessedAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a new user-tenant membership.
    /// </summary>
    /// <param name="membership">The membership to add.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The added membership with generated ID.</returns>
    Task<UserTenantMembership> AddAsync(UserTenantMembership membership, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an existing membership.
    /// </summary>
    /// <param name="membership">The membership to update.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    Task UpdateAsync(UserTenantMembership membership, CancellationToken cancellationToken = default);

    /// <summary>
    /// Soft deletes a user-tenant membership.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="deletedByUserId">The user performing the removal, when known.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>True if deleted; false if the membership didn't exist.</returns>
    Task<bool> RemoveAsync(
        Guid userId,
        Guid tenantId,
        Guid? deletedByUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a soft-deleted membership for the user/tenant pair, if one exists.
    /// Used to reactivate membership when a user is re-added after removal.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The soft-deleted membership when found; otherwise null.</returns>
    Task<UserTenantMembership?> GetSoftDeletedByUserAndTenantAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves soft-deleted memberships for a tenant (removed members), with User populated.
    /// </summary>
    Task<IEnumerable<UserTenantMembership>> GetSoftDeletedByTenantIdAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns true when the user has a soft-deleted membership in any tenant other than
    /// <paramref name="excludeTenantId"/>.
    /// </summary>
    Task<bool> HasSoftDeletedInOtherTenantsAsync(
        Guid userId,
        Guid excludeTenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a user has a live (non-deleted) membership in a tenant — Active or Suspended.
    /// </summary>
    Task<bool> ExistsAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a user has an Active membership that grants tenant access.
    /// </summary>
    Task<bool> ExistsActiveAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// True when the user has any non-deleted membership (Active or Suspended) in any tenant.
    /// Used to avoid minting a personal tenant for users who are only suspended elsewhere.
    /// </summary>
    Task<bool> HasLiveMembershipAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the count of Active users in a specific tenant (Suspended excluded).
    /// </summary>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The number of users in the tenant.</returns>
    Task<int> GetTenantUserCountAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the user IDs whose only non-deleted tenant membership is the supplied tenant.
    /// Used by tenant lifecycle operations to identify users who become orphaned when a tenant
    /// is deactivated or deleted.
    /// </summary>
    Task<List<Guid>> GetSoleTenantUserIdsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Soft-deletes every non-deleted membership for a tenant.
    /// </summary>
    Task<int> SoftDeleteAllForTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently removes every membership row for the given tenant.
    /// </summary>
    Task<int> HardDeleteAllForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently removes every membership row for the given user.
    /// </summary>
    Task<int> HardDeleteAllForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
