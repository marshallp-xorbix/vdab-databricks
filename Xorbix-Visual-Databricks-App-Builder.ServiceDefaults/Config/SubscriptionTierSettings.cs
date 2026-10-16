using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configuration for per-tier subscription limits.
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class SubscriptionTierSettings
{
    public const string ConfigurationSectionName = "SubscriptionTiers";

    public SubscriptionTierLimits Individual { get; set; } = new SubscriptionTierLimits();
    public SubscriptionTierLimits Team { get; set; } = new SubscriptionTierLimits();
    public SubscriptionTierLimits Enterprise { get; set; } = new SubscriptionTierLimits();
}