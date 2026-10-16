using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for redeeming a beta code and creating the no-card trial subscription.
/// </summary>
public class RedeemBetaCodeRequest
{
    /// <summary>
    /// Customer-facing beta code string.
    /// </summary>
    [Required(ErrorMessage = "Beta code is required")]
    [MaxLength(100, ErrorMessage = "Beta code cannot exceed 100 characters")]
    public required string Code { get; init; }
}
