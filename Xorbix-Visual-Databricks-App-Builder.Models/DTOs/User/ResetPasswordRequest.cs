using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for resetting password with token.
/// </summary>
public class ResetPasswordRequest : IValidatableObject
{
    [EmailAddress(ErrorMessage = "Invalid email address")]
    public string? Email { get; set; }

    public Guid? UserId { get; set; }

    [Required(ErrorMessage = "Reset token is required")]
    public required string Token { get; set; }

    [Required(ErrorMessage = "New password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters long")]
    public required string NewPassword { get; set; }

    [Required(ErrorMessage = "Confirm password is required")]
    [Compare("NewPassword", ErrorMessage = "The new password and confirmation password do not match")]
    public required string ConfirmPassword { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrEmpty(Email) && !UserId.HasValue)
        {
            yield return new ValidationResult("Either Email or UserId must be provided.", new[] { nameof(Email), nameof(UserId) });
        }
    }
}
