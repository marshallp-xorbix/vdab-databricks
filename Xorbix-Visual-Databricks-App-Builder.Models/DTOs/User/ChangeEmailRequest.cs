using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for changing user email address.
/// </summary>
public class ChangeEmailRequest
{
    /// <summary>
    /// The new email address.
    /// </summary>
    [Required(ErrorMessage = "New email is required")]
    [EmailAddress(ErrorMessage = "Invalid email address")]
    public required string NewEmail { get; set; }

    /// <summary>
    /// The user's current password. Required for self-service change on password-based (non-passwordless) accounts.
    /// </summary>
    public string? CurrentPassword { get; set; }
}
