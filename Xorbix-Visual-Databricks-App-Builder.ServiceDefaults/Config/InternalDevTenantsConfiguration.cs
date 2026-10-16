using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Allowlist of internal/dev tenants that receive complimentary seat management
/// (unlimited invites without Stripe seat purchases).
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class InternalDevTenantsConfiguration
{
    public const string ConfigurationSectionName = "InternalDevTenants";

    /// <summary>
    /// Gets or sets the tenant identifiers treated as internal/dev tenants.
    /// </summary>
    public Guid[] TenantIds { get; init; } = [];
}
