using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for updating user profile.
/// </summary>
public class UpdateProfileRequest
{
    [Required(ErrorMessage = "First name is required")]
    [MaxLength(100, ErrorMessage = "First name cannot exceed 100 characters")]
    public required string FirstName { get; set; }

    [Required(ErrorMessage = "Last name is required")]
    [MaxLength(100, ErrorMessage = "Last name cannot exceed 100 characters")]
    public required string LastName { get; set; }
}
