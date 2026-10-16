using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Canonical subscription history event type values written to <see cref="EF.SubscriptionHistory.EventType"/>.
/// </summary>
[ExcludeFromCodeCoverage]
public static class SubscriptionHistoryEventTypes
{
    /// <summary>Promotion code applied at subscription signup.</summary>
    public const string PromoApplied = nameof(PromoApplied);

    /// <summary>Subscription renewed after a billing period.</summary>
    public const string Renewed = nameof(Renewed);
}
