using System.Diagnostics.CodeAnalysis;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Shared tenant subscription eligibility checks for billing flows.
/// </summary>
[ExcludeFromCodeCoverage]
public static class TenantSubscriptionGuard
{
    /// <summary>
    /// Whether the tenant already has a non-canceled Stripe subscription on record.
    /// </summary>
    /// <param name="tenant">Tenant to evaluate.</param>
    /// <returns><c>true</c> when a new self-service subscription should be rejected.</returns>
    public static bool HasActiveSubscription(Tenant tenant)
    {
        return !string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId)
            && !string.Equals(tenant.SubscriptionStatus, TenantSubscriptionStatuses.None, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(tenant.SubscriptionStatus, TenantSubscriptionStatuses.Canceled, StringComparison.OrdinalIgnoreCase);
    }
}
