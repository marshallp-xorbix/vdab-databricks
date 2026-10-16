using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for removing extra seats.
/// </summary>
public class RemoveSeatsRequest
{
    /// <summary>
    /// Number of seats to remove.
    /// </summary>
    [Required(ErrorMessage = "Count is required")]
    [Range(1, int.MaxValue, ErrorMessage = "Count must be at least 1")]
    public int Count { get; init; }
}
