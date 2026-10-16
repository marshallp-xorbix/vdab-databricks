using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Request model for verifying passwordless authentication code.
/// </summary>
public class VerifyCodeRequest
{

    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email address")]
    public required string Email { get; set; }

    [Required(ErrorMessage = "Verification code is required")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "Verification code must be exactly 6 digits")]
    public required string Code { get; set; }
}
