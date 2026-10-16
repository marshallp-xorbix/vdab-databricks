using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for transferring a seat to a different user.
/// </summary>
public class TransferSeatRequest
{
    /// <summary>
    /// Identifier of the new user for the seat.
    /// </summary>
    [Required(ErrorMessage = "NewUserId is required")]
    public required Guid NewUserId { get; init; }
}
