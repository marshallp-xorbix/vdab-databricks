using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Request model for confirming email address.
/// </summary>
public class ConfirmEmailRequest
{

    [Required(ErrorMessage = "User ID is required")]
    public required Guid UserId { get; set; }

    [Required(ErrorMessage = "Confirmation token is required")]
    public required string Token { get; set; }
}
