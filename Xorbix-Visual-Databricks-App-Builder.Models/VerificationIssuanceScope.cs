namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Identifies the issuance surface a verification-code request arrives on. The throttle keeps a separate
/// backoff bucket per scope so traffic on one surface can never gate a request on another — anonymous
/// flooding cannot deny a request the user has backed with a stronger factor, nor starve an in-progress
/// 2FA resend.
/// </summary>
public enum VerificationIssuanceScope
{
    /// <summary>
    /// Anonymous passwordless sign-in (<c>passwordless/login</c>). Anyone who knows the address can drive
    /// this bucket, so it is deliberately isolated from the other scopes.
    /// </summary>
    Anonymous = 0,

    /// <summary>
    /// Requested only after the caller has already verified the user's password. Kept in its own keyspace
    /// so a user who knows their password can always receive a 2FA code, no matter how much anonymous
    /// traffic has been aimed at the same address.
    /// </summary>
    PasswordVerified = 1,

    /// <summary>
    /// Anonymous resend of an in-progress 2FA code (<c>2fa/resend</c>). Anonymous like
    /// <see cref="Anonymous"/>, but isolated from it so that flooding passwordless sign-in cannot starve a
    /// user who is mid-login and needs a fresh 2FA code. Still reachable anonymously, so a resend for a
    /// given address stays best-effort under a resend-targeted flood.
    /// </summary>
    TwoFactorResend = 2,
}
