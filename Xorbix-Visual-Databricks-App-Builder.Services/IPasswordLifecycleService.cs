using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for password lifecycle operations.
/// </summary>
public interface IPasswordLifecycleService
{
    /// <summary>
    /// Changes the current user's password.
    /// </summary>
    /// <param name="userId">The authenticated user ID.</param>
    /// <param name="currentPassword">The current password.</param>
    /// <param name="newPassword">The new password.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken = default);

    /// <summary>
    /// Initiates password reset by sending a reset link to the email address.
    /// Returns success for unknown or inactive users to prevent account enumeration.
    /// </summary>
    /// <param name="email">The user's email address.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ForgotPasswordAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resets a user's password using email and token.
    /// </summary>
    /// <param name="email">The user's email address.</param>
    /// <param name="token">The password reset token.</param>
    /// <param name="newPassword">The new password.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ResetPasswordAsync(string email, string token, string newPassword, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resets a user's password using user ID and token.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="token">The password reset token.</param>
    /// <param name="newPassword">The new password.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ResetPasswordAsync(Guid userId, string token, string newPassword, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks whether a user already has a password set.
    /// Returns false for invalid or inactive users to avoid leaking account state.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing true if a password exists; otherwise false.</returns>
    Task<Result<bool>> IsPasswordAlreadySetAsync(Guid userId, CancellationToken cancellationToken = default);
}
