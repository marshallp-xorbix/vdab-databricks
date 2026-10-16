namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Result of a successful promo code validation for display before subscribe.
/// </summary>
public class PromoCodeValidationDto
{
    /// <summary>
    /// Whether the promo code is valid for the requested tier and interval.
    /// </summary>
    public required bool IsValid { get; init; }

    /// <summary>
    /// Human-readable summary for the UI.
    /// </summary>
    public required string Message { get; init; }

    /// <summary>
    /// Number of free billing months granted by the coupon.
    /// </summary>
    public int FreeMonths { get; init; }

    /// <summary>
    /// Estimated UTC date when the promotional discount ends.
    /// </summary>
    public DateTime? DiscountEndsAt { get; init; }
}
