using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configurable clocks for account and membership lifecycle (§13 item 3).
/// Bound from the <c>AccountLifecycleConfiguration</c> section.
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class AccountLifecycleConfiguration
{
    public const string ConfigurationSectionName = "AccountLifecycleConfiguration";

    /// <summary>
    /// How many days an Ended membership can be restored with role intact.
    /// Defaults to 90.
    /// </summary>
    public int MembershipReinstatementDays { get; init; } = 90;

    /// <summary>
    /// How many days a Retired account keeps its real address before lazy anonymization
    /// (Phase 5). Null means disabled / unset.
    /// </summary>
    public int? RetiredAnonymizationDays { get; init; }
}
