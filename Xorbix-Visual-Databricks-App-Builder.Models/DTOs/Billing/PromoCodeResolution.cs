namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Internal resolution of a validated Stripe promotion code for subscription create.
/// </summary>
public class PromoCodeResolution
{
    /// <summary>
    /// Stripe promotion code identifier (promo_...).
    /// </summary>
    public required string PromotionCodeId { get; init; }

    /// <summary>
    /// Customer-facing code string.
    /// </summary>
    public required string Code { get; init; }

    /// <summary>
    /// Stripe coupon identifier.
    /// </summary>
    public required string CouponId { get; init; }

    /// <summary>
    /// Number of free billing months from the coupon.
    /// </summary>
    public int FreeMonths { get; init; }

    /// <summary>
    /// Estimated UTC date when the discount ends.
    /// </summary>
    public DateTime? DiscountEndsAt { get; init; }
}
