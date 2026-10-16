namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Response returned after successful email confirmation.
/// Indicates whether the user still needs to set a password before they can log in.
/// </summary>
public class ConfirmEmailResponse
{
    /// <summary>
    /// True when the user has no password and is not using passwordless login.
    /// The frontend should redirect to the set-password page.
    /// </summary>
    public bool RequiresPasswordSetup { get; init; }

    /// <summary>
    /// The user's ID. Included when <see cref="RequiresPasswordSetup"/> is true
    /// so the frontend can build the set-password URL.
    /// </summary>
    public Guid? UserId { get; init; }

    /// <summary>
    /// A fresh password-reset token generated after email confirmation.
    /// Included when <see cref="RequiresPasswordSetup"/> is true.
    /// </summary>
    public string? PasswordResetToken { get; init; }

    /// <summary>
    /// A complete authentication response (JWT access and refresh tokens) issued when the application runs in
    /// passwordless-only mode. Confirming the email proves possession of the inbox — the same trust basis as a
    /// passwordless verification code — so the user is signed in immediately and continues into account setup.
    /// Null in password-based mode, where the user must sign in separately after confirmation.
    /// </summary>
    public AuthResponse? AuthResponse { get; init; }
}
