using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for user account lifecycle operations.
/// </summary>
public interface IUserLifecycleService
{
    /// <summary>
    /// Deactivates a user account.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="deactivatedByUserId">The ID of the admin performing the deactivation.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> DeactivateUserAsync(Guid userId, Guid deactivatedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Locks the specified user account.
    /// </summary>
    /// <param name="userId">The user ID to lock.</param>
    /// <param name="lockedByUserId">The ID of the admin performing the lock.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> LockUserAsync(Guid userId, Guid lockedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Unlocks the specified user account.
    /// </summary>
    /// <param name="userId">The user ID to unlock.</param>
    /// <param name="unlockedByUserId">The ID of the admin performing the unlock.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> UnlockUserAsync(Guid userId, Guid unlockedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Restores a previously deactivated or retired user account, clearing any soft-delete tombstone.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="reactivatedByUserId">The ID of the admin performing the restore.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ReactivateUserAsync(Guid userId, Guid reactivatedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently purges all user-related data for GDPR compliance.
    /// </summary>
    /// <param name="userId">The user ID whose data should be purged.</param>
    /// <param name="deletedByUserId">The ID of the admin performing the purge.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> PurgeUserDataAsync(Guid userId, Guid deletedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lazily anonymizes retired accounts matching <paramref name="email"/> when they are
    /// older than <c>AccountLifecycleConfiguration.RetiredAnonymizationDays</c>.
    /// No-ops when the clock is unset/null. Best-effort: per-row failures are logged and the
    /// scan continues; callers must not fail registration on the returned result.
    /// </summary>
    /// <param name="email">The email address being registered or provisioned.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>
    /// Success when the clock is off, no candidates exist, or the scan finishes (including
    /// after per-row failures). Failure only for unexpected exceptions during the sweep.
    /// </returns>
    Task<Result> TryAnonymizeStaleRetiredByEmailAsync(string email, CancellationToken cancellationToken = default);
}
