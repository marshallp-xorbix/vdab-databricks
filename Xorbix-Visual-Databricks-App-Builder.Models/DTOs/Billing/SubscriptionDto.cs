namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents a tenant subscription.
/// </summary>
public class SubscriptionDto
{
    /// <summary>
    /// Stripe subscription identifier.
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Subscription tier (for example: Individual, Team).
    /// </summary>
    public required string Tier { get; init; }

    /// <summary>
    /// Current billing interval for the subscription, as a
    /// <see cref="Xorbix_Visual_Databricks_App_Builder.Models.Billing.BillingInterval"/> name
    /// ("Monthly" or "Yearly"), derived from the active Stripe price. Clients echo this back on a
    /// plan (tier) change so the billing cadence is preserved rather than reset to monthly.
    /// </summary>
    public string? BillingInterval { get; init; }

    /// <summary>
    /// Stripe subscription status (active, past_due, canceled, trialing, incomplete).
    /// </summary>
    public required string Status { get; init; }

    /// <summary>
    /// Current billing period start.
    /// </summary>
    public DateTime CurrentPeriodStart { get; init; }

    /// <summary>
    /// Current billing period end.
    /// </summary>
    public DateTime CurrentPeriodEnd { get; init; }

    /// <summary>
    /// Whether the subscription is scheduled to cancel at period end.
    /// </summary>
    public bool CancelAtPeriodEnd { get; init; }

    /// <summary>
    /// When the subscription was canceled, if applicable.
    /// </summary>
    public DateTime? CanceledAt { get; init; }

    /// <summary>
    /// Default payment method used for subscription charges.
    /// </summary>
    public PaymentMethodDto? DefaultPaymentMethod { get; init; }

    /// <summary>
    /// Current seat summary for the subscription, when available.
    /// </summary>
    public SeatSummaryDto? SeatSummary { get; init; }

    /// <summary>
    /// Total active non-canceled seats for this subscription.
    /// </summary>
    public int TotalSeats { get; init; }

    /// <summary>
    /// Stripe PaymentIntent client secret for confirming an incomplete subscription payment.
    /// Only populated when the subscription requires frontend payment confirmation.
    /// </summary>
    public string? ClientSecret { get; set; }

    /// <summary>
    /// Whether the tenant has a Stripe customer backing this plan. <c>true</c> for
    /// Stripe-managed subscriptions; <c>false</c> for manually provisioned plans
    /// (e.g., an administrator tier override) that have no Stripe billing account.
    /// Used by the UI to enable or disable billing and invoice features.
    /// </summary>
    public bool HasStripeCustomer { get; init; } = true;

    /// <summary>
    /// Whether the tenant may use Seats &amp; Users and the invite flow with complimentary
    /// (non-Stripe) seat capacity. True when the tenant is on the configured
    /// <c>InternalDevTenants</c> allowlist.
    /// </summary>
    public bool AllowsComplimentarySeatManagement { get; init; }

    /// <summary>
    /// Active promotional discount on the subscription, when present.
    /// </summary>
    public SubscriptionDiscountDto? Discount { get; init; }
}
