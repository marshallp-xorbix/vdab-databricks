using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for passwordless and two-factor verification code challenges.
/// </summary>
public interface IVerificationChallengeService
{
    /// <summary>
    /// Generates and sends a verification code to the user's email.
    /// </summary>
    /// <param name="email">The email address to send the code to.</param>
    /// <param name="scope">
    /// The issuance surface the request arrives on. Each scope throttles in its own backoff bucket, so
    /// the caller must pass the one matching the endpoint (anonymous passwordless sign-in,
    /// password-verified 2FA send, or anonymous 2FA resend).
    /// </param>
    /// <param name="user">Optional user object when already resolved by the caller.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>
    /// A result containing the code expiration and the next instant a code may be requested, or a
    /// <see cref="TooManyRequestsError"/> when the caller is inside the issuance backoff window.
    /// </returns>
    Task<Result<VerificationChallengeResponse>> SendVerificationCodeAsync(string email, VerificationIssuanceScope scope, ApplicationUser? user = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifies a submitted code and authenticates the user.
    /// </summary>
    /// <param name="email">The email address for the challenge.</param>
    /// <param name="code">The submitted verification code.</param>
    /// <param name="ipAddress">The client's IP address.</param>
    /// <param name="userAgent">The client's User-Agent.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the authentication response if verification succeeds.</returns>
    Task<Result<AuthResponse>> VerifyCodeAndAuthenticateAsync(string email, string code, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);
}
