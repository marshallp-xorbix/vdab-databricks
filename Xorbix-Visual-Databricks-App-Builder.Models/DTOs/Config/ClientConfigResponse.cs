namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Config;

/// <summary>
/// Non-secret, per-environment configuration delivered to the browser SPA at startup so a single build
/// artifact can be promoted across environments without rebuilding. Values are client-observable settings only.
/// </summary>
public sealed class ClientConfigResponse
{
    /// <summary>
    /// Application Insights connection string for browser telemetry, or <c>null</c> when telemetry is not
    /// configured for the environment.
    /// </summary>
    public string? ApplicationInsightsConnectionString { get; init; }

    /// <summary>
    /// When <c>true</c>, the application runs in passwordless-only mode: the SPA routes all sign-in traffic
    /// to the passwordless flow and hides every password workflow (standard login, password reset/change,
    /// and the login-method / 2FA toggles). Mirrors the server-side
    /// <c>AuthenticationConfiguration.PasswordlessOnly</c> switch.
    /// </summary>
    public bool PasswordlessOnly { get; init; }

    /// <summary>
    /// How many days an Ended membership can be restored. Mirrors
    /// <c>AccountLifecycleConfiguration.MembershipReinstatementDays</c>.
    /// </summary>
    public int MembershipReinstatementDays { get; init; }
}
