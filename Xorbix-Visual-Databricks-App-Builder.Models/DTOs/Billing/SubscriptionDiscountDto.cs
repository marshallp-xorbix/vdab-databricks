namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Active promotional discount on a Stripe-managed subscription.
/// </summary>
public class SubscriptionDiscountDto
{
    /// <summary>
    /// Customer-facing promotion code, when available.
    /// </summary>
    public string? PromoCode { get; init; }

    /// <summary>
    /// Number of free months configured on the coupon, when repeating.
    /// </summary>
    public int FreeMonths { get; init; }

    /// <summary>
    /// UTC date when the discount ends on the subscription.
    /// </summary>
    public DateTime? DiscountEndsAt { get; init; }

    /// <summary>
    /// Percentage off configured on the coupon.
    /// </summary>
    public decimal PercentOff { get; init; }
}
