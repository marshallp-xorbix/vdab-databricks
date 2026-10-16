using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for assigning a seat to a user.
/// </summary>
public class AssignSeatRequest
{
    /// <summary>
    /// Identifier of the user to assign to the seat.
    /// </summary>
    [Required(ErrorMessage = "UserId is required")]
    public required Guid UserId { get; init; }
}
