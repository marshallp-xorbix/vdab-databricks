using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository contract for managing <see cref="TenantInvite"/> rows.
/// </summary>
public interface ITenantInviteRepository
{
    /// <summary>
    /// Returns all pending (non-expired-by-status) invites for a tenant.
    /// </summary>
    Task<IEnumerable<TenantInvite>> GetPendingByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the invite (any status) by id.
    /// </summary>
    Task<TenantInvite?> GetByIdAsync(Guid inviteId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the invite by token-hash, regardless of status.
    /// </summary>
    Task<TenantInvite?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the existing pending invite for a (tenant, normalized-email) pair, if any.
    /// </summary>
    Task<TenantInvite?> GetPendingByEmailAsync(Guid tenantId, string normalizedEmail, CancellationToken cancellationToken = default);

    /// <summary>
    /// Persists a batch of new invites in a single SaveChanges call.
    /// </summary>
    Task AddRangeAsync(IEnumerable<TenantInvite> invites, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an invite (status changes, acceptance, etc.).
    /// </summary>
    Task UpdateAsync(TenantInvite invite, CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts pending, non-deleted invites across all tenants.
    /// </summary>
    Task<int> CountPendingInvitesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels every pending invite for a tenant and soft-deletes the rows.
    /// </summary>
    Task<int> CancelPendingByTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently removes every invite row for the given tenant.
    /// </summary>
    Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
