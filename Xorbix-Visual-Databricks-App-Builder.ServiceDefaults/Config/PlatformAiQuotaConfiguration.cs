using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configuration for per-user monthly token quotas on the VDAB Default AI Builder model.
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class PlatformAiQuotaConfiguration
{
    public const string ConfigurationSectionName = "PlatformAiQuota";

    /// <summary>
    /// When false, quota enforcement and usage recording are skipped (useful for local development).
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Maximum total tokens (input + output) a user may consume per UTC calendar month on the platform model.
    /// </summary>
    public long MonthlyTokenLimit { get; set; } = 100_000;
}
