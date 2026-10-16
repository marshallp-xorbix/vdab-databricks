using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Request model for beta signup registration. Creates the user and tenant, then redeems
/// the beta code to start a no-card trial before email confirmation.
/// </summary>
public class BetaRegisterRequest : RegisterRequest
{
    /// <summary>
    /// Customer-facing beta code to redeem after account creation.
    /// </summary>
    [Required(ErrorMessage = "Beta code is required")]
    [StringLength(100)]
    public required string BetaCode { get; init; }
}
