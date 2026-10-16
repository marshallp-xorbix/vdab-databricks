using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for session invalidation and token refresh security flows.
/// </summary>
public class SessionTokenSecurityService : ISessionTokenSecurityService
{
    private const string UnknownPlaceholder = "unknown";
    private const string UserNotFoundMessage = "User not found";

    private readonly ILogger<SessionTokenSecurityService> _logger;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtService _jwtService;
    private readonly IAuthResponseService _authResponseService;
    private readonly IAccountAccessPolicy _accountAccessPolicy;

    /// <summary>
    /// Initializes a new instance of the <see cref="SessionTokenSecurityService"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    /// <param name="userManager">The user manager.</param>
    /// <param name="jwtService">The JWT service.</param>
    /// <param name="authResponseService">The auth response service.</param>
    /// <param name="accountAccessPolicy">Whether the account may authenticate.</param>
    public SessionTokenSecurityService(
        ILogger<SessionTokenSecurityService> logger,
        UserManager<ApplicationUser> userManager,
        IJwtService jwtService,
        IAuthResponseService authResponseService,
        IAccountAccessPolicy accountAccessPolicy)
    {
        _logger = logger;
        _userManager = userManager;
        _jwtService = jwtService;
        _authResponseService = authResponseService;
        _accountAccessPolicy = accountAccessPolicy;
    }

    /// <inheritdoc/>
    public async Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Token refresh attempt from IP {IpAddress}", ipAddress ?? UnknownPlaceholder);

            Result<(string AccessToken, RefreshToken RefreshToken)> refreshResult = await _jwtService.RefreshAccessTokenAsync(refreshToken, ipAddress, userAgent, cancellationToken);
            if (refreshResult.IsFailed)
            {
                _logger.LogWarning("Token refresh failed: {Errors}", string.Join(", ", refreshResult.Errors.Select(error => error.Message)));
                return Result.Fail(new UnauthorizedError("Invalid or expired refresh token"));
            }

            (string _, RefreshToken newRefreshToken) = refreshResult.Value;

            ApplicationUser? user = await _userManager.FindByIdAsync(newRefreshToken.UserId.ToString());
            if (!_accountAccessPolicy.CanAuthenticate(user))
            {
                _logger.LogWarning("Token refresh for non-authenticable user {UserId}", newRefreshToken.UserId);
                return Result.Fail(new UnauthorizedError("User not found or inactive"));
            }

            Result<AuthResponse> authResponse = await _authResponseService.GenerateAuthResponseAsync(user!, ipAddress, userAgent, cancellationToken: cancellationToken);
            if (authResponse.IsFailed)
            {
                return authResponse;
            }

            _logger.LogInformation("Token refreshed successfully for user {UserId}", user!.Id);
            return authResponse;
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing token");
            return Result.Fail("Failed to refresh token. Please login again.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ForceLogoutAllDevicesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Force logout attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError(UserNotFoundMessage));
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("Force logout attempt for inactive user {UserId}", userId);
                return Result.Fail("Cannot force logout for inactive user");
            }

            IdentityResult stampResult = await _userManager.UpdateSecurityStampAsync(user);
            if (!stampResult.Succeeded)
            {
                string errors = string.Join(", ", stampResult.Errors.Select(error => error.Description));
                _logger.LogWarning("Failed to update security stamp for user {UserId}: {Errors}", userId, errors);
                return Result.Fail($"Failed to update security stamp: {errors}");
            }

            Result revokeResult = await RevokeAllUserRefreshTokensAsync(userId, cancellationToken);
            if (revokeResult.IsFailed)
            {
                _logger.LogWarning("Security stamp updated but failed to revoke refresh tokens for user {UserId}", userId);
            }

            _logger.LogInformation("Security stamp updated successfully for user {UserId} ({Email}), all sessions invalidated", userId, user.Email);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating security stamp for user {UserId}", userId);
            return Result.Fail("Failed to update security stamp. Please try again.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ForceLogoutTenantSessionsAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Tenant-scoped force logout attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError(UserNotFoundMessage));
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("Tenant-scoped force logout attempt for inactive user {UserId}", userId);
                return Result.Fail("Cannot force logout for inactive user");
            }

            Result<int> revokeResult = await _jwtService.RevokeAllUserRefreshTokensForTenantAsync(
                userId,
                tenantId,
                cancellationToken);
            if (revokeResult.IsFailed)
            {
                return Result.Fail(revokeResult.Errors);
            }

            _logger.LogInformation(
                "Revoked {Count} tenant-scoped sessions for user {UserId} in tenant {TenantId}",
                revokeResult.Value,
                userId,
                tenantId);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error revoking tenant sessions for user {UserId} in tenant {TenantId}",
                userId,
                tenantId);
            return Result.Fail("Failed to revoke tenant sessions. Please try again.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> LogoutCurrentSessionAsync(Guid userId, string refreshToken, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                _logger.LogWarning("Logout attempt for user {UserId} without a refresh token", userId);
                return Result.Fail("Refresh token is required");
            }

            Result<RefreshToken> validateResult = await _jwtService.ValidateRefreshTokenAsync(refreshToken, cancellationToken);
            if (validateResult.IsFailed)
            {
                _logger.LogInformation("Logout attempt for user {UserId} with invalid or expired refresh token; treating as success", userId);
                return Result.Ok();
            }

            if (validateResult.Value.UserId != userId)
            {
                _logger.LogWarning("Logout attempt for user {UserId} with refresh token belonging to user {OtherUserId}", userId, validateResult.Value.UserId);
                return Result.Fail(new UnauthorizedError("Refresh token does not belong to the authenticated user"));
            }

            Result revokeResult = await _jwtService.RevokeRefreshTokenAsync(refreshToken, cancellationToken);
            if (revokeResult.IsFailed)
            {
                _logger.LogWarning("Failed to revoke refresh token for user {UserId} during logout", userId);
                return revokeResult;
            }

            _logger.LogInformation("User {UserId} logged out of current session", userId);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging out current session for user {UserId}", userId);
            return Result.Fail("Failed to log out. Please try again.");
        }
    }

    /// <summary>
    /// Revokes all refresh tokens for a user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    private async Task<Result> RevokeAllUserRefreshTokensAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<int> revokeResult = await _jwtService.RevokeAllUserRefreshTokensAsync(userId, cancellationToken);

            if (revokeResult.IsFailed)
            {
                _logger.LogError("Failed to revoke refresh tokens for user {UserId}", userId);
                return Result.Fail(revokeResult.Errors);
            }

            _logger.LogInformation("All refresh tokens revoked for user {UserId} ({Count} tokens)", userId, revokeResult.Value);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking refresh tokens for user {UserId}", userId);
            return Result.Fail("Failed to revoke tokens. Please try again.");
        }
    }
}
