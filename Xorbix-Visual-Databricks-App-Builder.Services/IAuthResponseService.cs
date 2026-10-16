using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for generating authentication responses with tenant-aware JWT context.
/// </summary>
public interface IAuthResponseService
{
    /// <summary>
    /// Generates access and refresh tokens and builds a complete authentication response.
    /// </summary>
    /// <param name="user">The authenticated user.</param>
    /// <param name="ipAddress">The client's IP address for security tracking.</param>
    /// <param name="userAgent">The client's User-Agent for security tracking.</param>
    /// <param name="twoFactorChallenge">
    /// When supplied, no tokens are issued: the response instead reports that a second factor is
    /// required, carrying the code expiry and the next instant a code may be requested.
    /// </param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the complete authentication response.</returns>
    Task<Result<AuthResponse>> GenerateAuthResponseAsync(
        ApplicationUser user,
        string? ipAddress = null,
        string? userAgent = null,
        VerificationChallengeResponse? twoFactorChallenge = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates an authentication response for a specific tenant context.
    /// </summary>
    /// <param name="user">The authenticated user.</param>
    /// <param name="tenantId">The target tenant ID.</param>
    /// <param name="tenantRole">The user's role in the target tenant.</param>
    /// <param name="ipAddress">The client's IP address for security tracking.</param>
    /// <param name="userAgent">The client's User-Agent for security tracking.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the authentication response with tenant context.</returns>
    Task<Result<AuthResponse>> GenerateAuthResponseForTenantAsync(
        ApplicationUser user,
        Guid tenantId,
        string tenantRole,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default);
}
