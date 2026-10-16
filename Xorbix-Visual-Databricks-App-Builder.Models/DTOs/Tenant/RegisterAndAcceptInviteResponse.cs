using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Response from registering a brand-new user while accepting a tenant invite.
/// </summary>
public class RegisterAndAcceptInviteResponse
{
    /// <summary>
    /// A complete authentication response (JWT access and refresh tokens) issued when the application runs in
    /// passwordless-only mode. Accepting the invite proves possession of the invited inbox — the same trust
    /// basis as a passwordless verification code — so the new user is signed in immediately and continues into
    /// the app. Null in password-based mode, where the user signs in separately after registering.
    /// </summary>
    public AuthResponse? AuthResponse { get; init; }
}
