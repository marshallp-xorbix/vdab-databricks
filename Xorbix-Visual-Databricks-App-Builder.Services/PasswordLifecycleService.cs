using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for password lifecycle flows including change, reset, and status checks.
/// </summary>
public class PasswordLifecycleService : IPasswordLifecycleService
{
    private const string PasswordManagementDisabledMessage = "Password management is disabled. This account uses passwordless sign-in.";

    private readonly ILogger<PasswordLifecycleService> _logger;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailSenderService _emailSender;
    private readonly IJwtService _jwtService;
    private readonly bool _passwordlessOnly;
    private readonly string _resetPasswordUrl;

    /// <summary>
    /// Initializes a new instance of the <see cref="PasswordLifecycleService"/> class.
    /// </summary>
    /// <param name="logger">The logger instance.</param>
    /// <param name="userManager">The user manager instance.</param>
    /// <param name="emailSender">The email sender service instance.</param>
    /// <param name="jwtService">The JWT service instance.</param>
    /// <param name="appConfig">The application configuration options.</param>
    /// <param name="authConfig">The authentication configuration options.</param>
    /// <exception cref="ArgumentException">Thrown when FrontendUrl is not configured.</exception>
    public PasswordLifecycleService(
        ILogger<PasswordLifecycleService> logger,
        UserManager<ApplicationUser> userManager,
        IEmailSenderService emailSender,
        IJwtService jwtService,
        IOptions<ApplicationConfiguration> appConfig,
        IOptions<AuthenticationConfiguration> authConfig)
    {
        _logger = logger;
        _userManager = userManager;
        _emailSender = emailSender;
        _jwtService = jwtService;
        _passwordlessOnly = authConfig.Value.PasswordlessOnly;

        if (string.IsNullOrEmpty(appConfig.Value.FrontendUrl))
        {
            _logger.LogError("FrontendUrl is not configured in ApplicationConfiguration");
            throw new ArgumentException("FrontendUrl must be configured in ApplicationConfiguration");
        }

        _resetPasswordUrl = $"{appConfig.Value.FrontendUrl}/{ClientRoutes.ResetPassword}";
    }

    /// <inheritdoc/>
    public async Task<Result> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken = default)
    {
        if (_passwordlessOnly)
        {
            _logger.LogWarning("Change password attempt rejected for user {UserId}: passwordless-only mode is enabled", userId);
            return Result.Fail(new ForbiddenError(PasswordManagementDisabledMessage));
        }

        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Change password attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError("User not found"));
            }

            IdentityResult changeResult = await _userManager.ChangePasswordAsync(user, currentPassword, newPassword);
            if (!changeResult.Succeeded)
            {
                _logger.LogWarning("Change password failed for user {UserId}: {Errors}",
                    userId, string.Join(", ", changeResult.Errors.Select(error => error.Description)));
                return Result.Fail(changeResult.Errors.Select(error => error.Description).First());
            }

            user.ModifiedOn = DateTime.UtcNow;
            user.ModifiedBy = userId;
            await _userManager.UpdateAsync(user);

            Result invalidateSessionsResult = await InvalidateUserSessionsAsync(user, cancellationToken);
            if (invalidateSessionsResult.IsFailed)
            {
                _logger.LogWarning("Password changed but failed to invalidate sessions for user {UserId}", userId);
            }

            _logger.LogInformation("Password changed successfully for user {UserId}", userId);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error changing password for user {UserId}", userId);
            return Result.Fail("Failed to change password. Please try again.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ForgotPasswordAsync(string email, CancellationToken cancellationToken = default)
    {
        if (_passwordlessOnly)
        {
            _logger.LogWarning("Forgot password attempt rejected for {Email}: passwordless-only mode is enabled", email);
            return Result.Fail(new ForbiddenError(PasswordManagementDisabledMessage));
        }

        try
        {
            ApplicationUser? user = await _userManager.FindByEmailAsync(email);
            if (user == null || !user.IsActive)
            {
                _logger.LogInformation("Forgot password attempt for non-existent or inactive email: {Email}", email);
                return Result.Ok();
            }

            string token = await _userManager.GeneratePasswordResetTokenAsync(user);
            string resetLink = $"{_resetPasswordUrl}?{UrlParams.UserId}={user.Id}&{UrlParams.ResetToken}={Uri.EscapeDataString(token)}";

            await _emailSender.SendPasswordResetLinkAsync(user, email, resetLink);

            _logger.LogInformation("Password reset email sent to {Email}", email);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing forgot password for {Email}", email);
            return Result.Ok();
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ResetPasswordAsync(string email, string token, string newPassword, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                _logger.LogWarning("Reset password attempt for non-existent email: {Email}", email);
                return Result.Fail(new NotFoundError("Invalid reset request"));
            }

            return await ResetPasswordInternalAsync(user, token, newPassword, cancellationToken);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting password for email {Email}", email);
            return Result.Fail("Password reset failed. Please try again.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ResetPasswordAsync(Guid userId, string token, string newPassword, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Reset password attempt for non-existent userId: {UserId}", userId);
                return Result.Fail(new NotFoundError("Invalid reset request"));
            }

            return await ResetPasswordInternalAsync(user, token, newPassword, cancellationToken);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting password for user {UserId}", userId);
            return Result.Fail("Password reset failed. Please try again.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<bool>> IsPasswordAlreadySetAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null || !user.IsActive)
            {
                _logger.LogInformation("Password status check for invalid or inactive user {UserId}", userId);
                return Result.Ok(false);
            }

            bool hasPassword = await _userManager.HasPasswordAsync(user);
            return Result.Ok(hasPassword);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking password status for user {UserId}", userId);
            return Result.Fail<bool>("Failed to check password status.");
        }
    }

    /// <summary>
    /// Performs password reset for a resolved user and invalidates active sessions.
    /// </summary>
    /// <param name="user">The resolved user.</param>
    /// <param name="token">The password reset token.</param>
    /// <param name="newPassword">The new password.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    private async Task<Result> ResetPasswordInternalAsync(ApplicationUser user, string token, string newPassword, CancellationToken cancellationToken = default)
    {
        if (_passwordlessOnly)
        {
            _logger.LogWarning("Reset password attempt rejected for user {UserId}: passwordless-only mode is enabled", user.Id);
            return Result.Fail(new ForbiddenError(PasswordManagementDisabledMessage));
        }

        IdentityResult resetResult = await _userManager.ResetPasswordAsync(user, token, newPassword);
        if (!resetResult.Succeeded)
        {
            _logger.LogWarning("Reset password failed for user {UserId}: {Errors}",
                user.Id, string.Join(", ", resetResult.Errors.Select(error => error.Description)));
            return Result.Fail("Invalid or expired reset token");
        }

        user.ModifiedOn = DateTime.UtcNow;
        user.ModifiedBy = user.Id;
        await _userManager.UpdateAsync(user);

        Result invalidateSessionsResult = await InvalidateUserSessionsAsync(user, cancellationToken);
        if (invalidateSessionsResult.IsFailed)
        {
            _logger.LogWarning("Password reset but failed to invalidate sessions for user {UserId}", user.Id);
        }

        _logger.LogInformation("Password reset successfully for user {UserId}", user.Id);
        return Result.Ok();
    }

    /// <summary>
    /// Invalidates all active sessions by rotating security stamp and revoking refresh tokens.
    /// </summary>
    /// <param name="user">The target user.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    private async Task<Result> InvalidateUserSessionsAsync(ApplicationUser user, CancellationToken cancellationToken = default)
    {
        IdentityResult stampResult = await _userManager.UpdateSecurityStampAsync(user);
        if (!stampResult.Succeeded)
        {
            string errors = string.Join(", ", stampResult.Errors.Select(error => error.Description));
            _logger.LogWarning("Failed to update security stamp for user {UserId}: {Errors}", user.Id, errors);
            return Result.Fail($"Failed to update security stamp: {errors}");
        }

        Result<int> revokeTokensResult = await _jwtService.RevokeAllUserRefreshTokensAsync(user.Id, cancellationToken);
        if (revokeTokensResult.IsFailed)
        {
            _logger.LogWarning("Security stamp updated but failed to revoke refresh tokens for user {UserId}", user.Id);
            return Result.Fail(revokeTokensResult.Errors);
        }

        _logger.LogInformation("All refresh tokens revoked for user {UserId} ({Count} tokens)", user.Id, revokeTokensResult.Value);
        return Result.Ok();
    }
}
