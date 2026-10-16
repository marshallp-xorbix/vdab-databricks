using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository contract for <see cref="BetaCode"/> and <see cref="BetaCodeRedemption"/> records.
/// </summary>
public interface IBetaCodeRepository
{
    /// <summary>
    /// Retrieves a beta code by its normalized (uppercase) code string. Soft-deleted codes are excluded.
    /// </summary>
    /// <param name="normalizedCode">Uppercase code string.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The matching beta code, or null when none exists.</returns>
    Task<BetaCode?> GetByCodeAsync(string normalizedCode, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically increments the redemption count of a beta code, guarding against
    /// over-redemption. The update only applies while the code is active, not soft-deleted,
    /// and below its redemption limit.
    /// </summary>
    /// <param name="betaCodeId">The beta code identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>True when the increment was applied; false when the code was no longer redeemable.</returns>
    Task<bool> TryIncrementRedemptionAsync(Guid betaCodeId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Determines whether the tenant has already redeemed any beta code.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>True when a redemption exists for the tenant.</returns>
    Task<bool> HasTenantRedeemedAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Persists a beta code redemption record.
    /// </summary>
    /// <param name="redemption">The redemption to add.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    Task AddRedemptionAsync(BetaCodeRedemption redemption, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically decrements the redemption count of a beta code, releasing a reservation taken
    /// by <see cref="TryIncrementRedemptionAsync"/>. Used to compensate when subscription
    /// creation fails after the slot was reserved but before any redemption record was written.
    /// </summary>
    /// <param name="betaCodeId">The beta code identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    Task ReleaseRedemptionAsync(Guid betaCodeId, CancellationToken cancellationToken = default);

    /// <summary>Permanently removes every beta code redemption row for the given tenant.</summary>
    Task<int> HardDeleteRedemptionsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
