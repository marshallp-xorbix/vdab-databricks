namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Response returned when a passwordless / 2FA verification code is issued. Carries both the code
/// expiry and the next instant another code may be requested, so the client drives its resend
/// countdown from the server's throttle instead of duplicating the schedule.
/// </summary>
public class VerificationChallengeResponse
{
    /// <summary>Gets the UTC instant the issued code expires.</summary>
    public required DateTime ExpiresAt { get; init; }

    /// <summary>Gets the UTC instant at which another code may be requested.</summary>
    public required DateTime ResendAvailableAt { get; init; }
}
