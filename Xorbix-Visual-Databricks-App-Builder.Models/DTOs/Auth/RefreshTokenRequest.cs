using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Request model for refreshing JWT access token.
/// </summary>
public class RefreshTokenRequest
{
    /// <summary>
    /// The refresh token to use for generating a new access token.
    /// </summary>
    [Required(ErrorMessage = "Refresh token is required")]
    public required string RefreshToken { get; set; }
}
