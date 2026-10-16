namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for per-user, per-tenant JSON preference storage.
/// </summary>
public interface IUserTenantPreferenceRepository
{
    /// <summary>
    /// Gets an integer preference value for the user in the tenant.
    /// </summary>
    Task<int?> GetIntPreferenceAsync(
        Guid userId,
        Guid tenantId,
        string key,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets or clears an integer preference for the user in the tenant.
    /// Returns false when the user has no active membership in the tenant.
    /// Skips the write when the stored value is already equal to <paramref name="value"/>.
    /// </summary>
    Task<bool> UpsertIntPreferenceAsync(
        Guid userId,
        Guid tenantId,
        string key,
        int? value,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a preference key from all users in the tenant when it matches <paramref name="intValue"/>.
    /// Does not call <c>SaveChanges</c>; the caller must persist changes.
    /// </summary>
    Task ClearIntPreferenceForTenantAsync(
        Guid tenantId,
        string key,
        int intValue,
        CancellationToken cancellationToken = default);

    /// <summary>Permanently removes every preference row for the given tenant.</summary>
    Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Permanently removes every preference row for the given user.</summary>
    Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
