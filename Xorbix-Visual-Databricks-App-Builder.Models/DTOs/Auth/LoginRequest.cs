using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Request model for user login.
/// </summary>
public class LoginRequest
{

    [Required]
    [EmailAddress]
    public required string Email { get; set; }


    [Required]
    public required string Password { get; set; }
}