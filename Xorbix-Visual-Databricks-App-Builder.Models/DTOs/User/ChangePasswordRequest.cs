using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for changing password, identifies user via authentication.
/// </summary>
public class ChangePasswordRequest
{
    [Required(ErrorMessage = "Current password is required")]
    public required string CurrentPassword { get; set; }

    [Required(ErrorMessage = "New password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters long")]
    public required string NewPassword { get; set; }

    [Required(ErrorMessage = "Confirm password is required")]
    [Compare("NewPassword", ErrorMessage = "The new password and confirmation password do not match")]
    public required string ConfirmPassword { get; set; }
}
