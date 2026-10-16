using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for purchasing additional seats.
/// </summary>
public class PurchaseSeatsRequest
{
    /// <summary>
    /// Number of seats to purchase.
    /// </summary>
    [Required(ErrorMessage = "Count is required")]
    [Range(1, int.MaxValue, ErrorMessage = "Count must be at least 1")]
    public int Count { get; init; }
}
