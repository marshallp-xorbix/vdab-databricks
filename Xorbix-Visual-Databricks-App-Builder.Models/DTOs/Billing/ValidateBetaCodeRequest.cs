using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for validating a beta code before starting a no-card trial.
/// </summary>
public class ValidateBetaCodeRequest
{
    /// <summary>
    /// Customer-facing beta code string.
    /// </summary>
    [Required(ErrorMessage = "Beta code is required")]
    [MaxLength(100, ErrorMessage = "Beta code cannot exceed 100 characters")]
    public required string Code { get; init; }
}
