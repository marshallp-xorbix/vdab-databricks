using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for anonymous beta code preview validation during signup.
/// </summary>
public class ValidateBetaCodePreviewRequest
{
    /// <summary>
    /// Customer-facing beta code string.
    /// </summary>
    [Required(ErrorMessage = "Beta code is required")]
    [MaxLength(100, ErrorMessage = "Beta code cannot exceed 100 characters")]
    public required string Code { get; init; }

    /// <summary>
    /// Optional tier selected by the user; when provided, the code must grant that tier.
    /// </summary>
    [StringLength(50)]
    public string? Tier { get; init; }
}
