using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for session and token security operations.
/// </summary>
public interface ISessionTokenSecurityService
{
    /// <summary>
    /// Refreshes an access token using a refresh token and returns a full auth response.
    /// </summary>
    /// <param name="refreshToken">The refresh token.</param>
    /// <param name="ipAddress">The client IP address.</param>
    /// <param name="userAgent">The client user agent.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the refreshed authentication response.</returns>
    Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Invalidates all active sessions for a user by rotating security stamp and revoking refresh tokens.
    /// Account-global — use only for self-service or Xorbix-operator paths.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ForceLogoutAllDevicesAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes refresh tokens minted under <paramref name="tenantId"/> without rotating the
    /// account-wide security stamp. Used by tenant admins so logout stays tenant-scoped.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="tenantId">The tenant whose sessions should be revoked.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ForceLogoutTenantSessionsAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Logs the user out of the current session by revoking only the supplied refresh token.
    /// Other active sessions on other devices remain valid.
    /// </summary>
    /// <param name="userId">The authenticated user ID; used to verify ownership of the token.</param>
    /// <param name="refreshToken">The refresh token associated with the session being logged out.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> LogoutCurrentSessionAsync(Guid userId, string refreshToken, CancellationToken cancellationToken = default);
}
