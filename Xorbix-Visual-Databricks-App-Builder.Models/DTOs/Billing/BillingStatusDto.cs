namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents billing status summary for the current tenant.
/// </summary>
public class BillingStatusDto
{
    /// <summary>
    /// Indicates whether the tenant currently has an active or trialing subscription.
    /// </summary>
    public bool HasSubscription { get; init; }

    /// <summary>
    /// Current subscription details when a subscription exists.
    /// </summary>
    public SubscriptionDto? Subscription { get; init; }

    /// <summary>
    /// Current aggregated seat counts for the tenant subscription, when available.
    /// </summary>
    public SeatSummaryDto? SeatSummary { get; init; }

    /// <summary>
    /// All saved customer payment methods.
    /// </summary>
    public IList<PaymentMethodDto> PaymentMethods { get; init; } = new List<PaymentMethodDto>();

    /// <summary>
    /// Stripe ID of the default payment method.
    /// </summary>
    public string? DefaultPaymentMethodId { get; init; }
}
