using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configuration for tenant invitation tokens (Phase 3).
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class TenantInviteConfiguration
{
    public const string ConfigurationSectionName = "TenantInviteConfiguration";

    /// <summary>
    /// Gets or sets the number of days an invite token is valid for. Defaults to 7.
    /// </summary>
    public int TokenExpirationDays { get; init; } = 7;

    /// <summary>
    /// Gets or sets the maximum number of invites that can be submitted in a single batch.
    /// Defaults to 50.
    /// </summary>
    public int MaxBatchSize { get; init; } = 50;
}
