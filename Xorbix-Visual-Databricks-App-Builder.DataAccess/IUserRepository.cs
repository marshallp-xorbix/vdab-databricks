using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for managing user data access.
/// </summary>
public interface IUserRepository
{
    /// <summary>
    /// Retrieves all users with their roles populated.
    /// </summary>
    /// <returns>A list of users with roles.</returns>
    Task<IEnumerable<ApplicationUser>> GetUsersWithRolesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves soft-deleted (retired) users that have not been anonymized, with roles populated.
    /// </summary>
    Task<IEnumerable<ApplicationUser>> GetRetiredUsersWithRolesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Finds retired (soft-deleted, not yet anonymized) users whose normalized email matches.
    /// Bypasses <c>TombstoneAwareUserStore</c> so registration can trigger lazy anonymization.
    /// </summary>
    /// <param name="normalizedEmail">Identity-normalized email (uppercase).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<IReadOnlyList<ApplicationUser>> GetRetiredByNormalizedEmailAsync(
        string normalizedEmail,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves all active users with their roles populated.
    /// </summary>
    /// <returns>A list of active users with roles.</returns>
    Task<IEnumerable<ApplicationUser>> GetActiveUsersWithRolesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves users with roles for members of the specified tenant.
    /// </summary>
    Task<IEnumerable<ApplicationUser>> GetUsersWithRolesForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves active users with roles for members of the specified tenant.
    /// </summary>
    Task<IEnumerable<ApplicationUser>> GetActiveUsersWithRolesForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts non-deleted users where <see cref="ApplicationUser.IsActive"/> is <c>true</c>.
    /// </summary>
    Task<int> CountActiveUsersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts non-deleted users whose <c>CreatedOn</c> is greater than or equal to <paramref name="sinceUtc"/>.
    /// </summary>
    Task<int> CountUsersCreatedSinceAsync(DateTime sinceUtc, CancellationToken cancellationToken = default);
}
