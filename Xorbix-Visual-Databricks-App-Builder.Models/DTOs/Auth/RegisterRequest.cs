using System.ComponentModel.DataAnnotations;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Request model for user registration.
/// </summary>
public class RegisterRequest : CreateUserRequest
{
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    public string? Password { get; init; }

    /// <summary>
    /// Optional subscription tier selected during signup (e.g. "Trial", "Individual", "Team").
    /// </summary>
    [StringLength(50)]
    public string? Tier { get; init; }
}
