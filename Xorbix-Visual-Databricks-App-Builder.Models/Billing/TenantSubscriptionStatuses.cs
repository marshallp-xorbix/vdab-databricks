using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Canonical tenant subscription status values used for billing guards.
/// </summary>
[ExcludeFromCodeCoverage]
public static class TenantSubscriptionStatuses
{
    /// <summary>Tenant has no Stripe subscription.</summary>
    public const string None = "none";

    /// <summary>Stripe subscription is canceled.</summary>
    public const string Canceled = "canceled";
}
