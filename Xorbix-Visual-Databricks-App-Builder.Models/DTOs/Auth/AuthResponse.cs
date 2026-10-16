using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Response model for authentication operations.
/// </summary>
public class AuthResponse
{
    public required string AccessToken { get; init; }
    public required string RefreshToken { get; init; }
    public required DateTime ExpiresAt { get; init; }
    public bool? TwoFactorRequired { get; init; }
    public DateTime? TwoFactorExpiresAt { get; init; }

    /// <summary>
    /// UTC instant at which another two-factor code may be requested. Mirrors
    /// <see cref="VerificationChallengeResponse.ResendAvailableAt"/> so the password + 2FA path drives
    /// its resend countdown from the server's backoff, exactly as the passwordless path does.
    /// </summary>
    public DateTime? TwoFactorResendAvailableAt { get; init; }
    public UserInfo? User { get; init; }
}