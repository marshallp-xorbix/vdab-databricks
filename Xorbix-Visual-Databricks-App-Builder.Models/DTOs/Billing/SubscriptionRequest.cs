using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for creating or updating a subscription.
/// </summary>
public class SubscriptionRequest
{
    /// <summary>
    /// Target subscription tier (for example: Trial, Individual, Team).
    /// </summary>
    [Required(ErrorMessage = "Tier is required")]
    [MaxLength(50, ErrorMessage = "Tier cannot exceed 50 characters")]
    public required string Tier { get; init; }

    /// <summary>
    /// Billing interval (for example: Monthly, Yearly).
    /// </summary>
    [Required(ErrorMessage = "Billing interval is required")]
    [MaxLength(20, ErrorMessage = "Billing interval cannot exceed 20 characters")]
    public required string BillingInterval { get; init; }

    /// <summary>
    /// Optional promotion code to apply at subscription creation (signup only).
    /// </summary>
    [MaxLength(100, ErrorMessage = "Promo code cannot exceed 100 characters")]
    public string? PromoCode { get; init; }

    /// <summary>
    /// When true, start the subscription as a trial (if the tier supports one). A payment
    /// method is still required; the subscription auto-converts to paid at trial end unless
    /// cancelled. Ignored on update.
    /// </summary>
    public bool StartTrial { get; init; }
}
