using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for validating a promo code before subscription signup.
/// </summary>
public class ValidatePromoCodeRequest
{
    /// <summary>
    /// Customer-facing promotion code string.
    /// </summary>
    [Required(ErrorMessage = "Promo code is required")]
    [MaxLength(100, ErrorMessage = "Promo code cannot exceed 100 characters")]
    public required string Code { get; init; }

    /// <summary>
    /// Target subscription tier (Individual or Team).
    /// </summary>
    [Required(ErrorMessage = "Tier is required")]
    [MaxLength(50, ErrorMessage = "Tier cannot exceed 50 characters")]
    public required string Tier { get; init; }

    /// <summary>
    /// Billing interval (Monthly only for promo v1).
    /// </summary>
    [Required(ErrorMessage = "Billing interval is required")]
    [MaxLength(20, ErrorMessage = "Billing interval cannot exceed 20 characters")]
    public required string BillingInterval { get; init; }
}
