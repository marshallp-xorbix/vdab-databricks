using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for generating and validating JWT tokens.
/// </summary>
public interface IJwtService
{
    /// <summary>
    /// Generates a JWT access token for the specified user with tenant context.
    /// </summary>
    /// <param name="user">The user to generate the token for.</param>
    /// <param name="roles">The user's roles (includes both global Administrator from Identity and tenant-specific role).</param>
    /// <param name="sessionId">The refresh-token rotation chain identifier for this login session.</param>
    /// <param name="tenantId">The current tenant ID (null if user has no tenant memberships).</param>
    /// <param name="tenantRole">The user's role within the current tenant (null if user has no tenant memberships).</param>
    /// <returns>A result containing the JWT token.</returns>
    Task<Result<string>> GenerateAccessTokenAsync(
        ApplicationUser user,
        IList<string> roles,
        Guid sessionId,
        Guid? tenantId = null,
        string? tenantRole = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates and stores a refresh token for a user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="ipAddress">The IP address of the request.</param>
    /// <param name="userAgent">The user agent of the request.</param>
    /// <param name="tenantId">The tenant context this session is minted under (null when detached).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result containing the refresh token.</returns>
    Task<Result<RefreshToken>> GenerateAndStoreRefreshTokenAsync(
        Guid userId,
        string? ipAddress = null,
        string? userAgent = null,
        Guid? tenantId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates a refresh token.
    /// </summary>
    /// <param name="token">The refresh token to validate.</param>
    /// <returns>A result indicating whether the token is valid.</returns>
    Task<Result<RefreshToken>> ValidateRefreshTokenAsync(string token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes a refresh token.
    /// </summary>
    /// <param name="token">The refresh token to revoke.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> RevokeRefreshTokenAsync(string token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes all refresh tokens for a user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <returns>A result indicating the number of tokens revoked.</returns>
    Task<Result<int>> RevokeAllUserRefreshTokensAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes all refresh tokens for a user that were minted under <paramref name="tenantId"/>.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="tenantId">The tenant whose sessions should be revoked.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result indicating the number of tokens revoked.</returns>
    Task<Result<int>> RevokeAllUserRefreshTokensForTenantAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Refreshes an access token using a refresh token.
    /// </summary>
    /// <param name="refreshToken">The refresh token.</param>
    /// <param name="ipAddress">The IP address of the request.</param>
    /// <param name="userAgent">The user agent of the request.</param>
    /// <returns>A result containing the new access token and refresh token.</returns>
    Task<Result<(string AccessToken, RefreshToken RefreshToken)>> RefreshAccessTokenAsync(string refreshToken, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);
}