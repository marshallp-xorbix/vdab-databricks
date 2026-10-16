using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Feature-flag style configuration governing which authentication methods the application offers.
/// Bound from the <c>AuthenticationConfiguration</c> section. This is a deliberately simple config switch
/// (not Microsoft.FeatureManagement) so it can be served to the browser SPA through <c>ConfigController</c>
/// before the user authenticates.
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class AuthenticationConfiguration
{
    public const string ConfigurationSectionName = "AuthenticationConfiguration";

    /// <summary>
    /// When <c>true</c>, password-based authentication is disabled application-wide and every user is forced
    /// onto the passwordless (email verification code) flow: password sign-in and password-lifecycle endpoints
    /// are rejected, new users are provisioned with passwordless login, and the SPA hides all password
    /// workflows. Defaults to <c>true</c>.
    /// </summary>
    public bool PasswordlessOnly { get; init; } = true;
}
