using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Anonymous request payload used when an invitee does not yet have a user account.
/// Creates the user and accepts the invite in one call.
/// </summary>
public class RegisterAndAcceptInviteRequest
{
    /// <summary>The raw invite token delivered to the invitee.</summary>
    [Required]
    public required string Token { get; init; }

    [Required(ErrorMessage = "First name is required")]
    [StringLength(100, ErrorMessage = "First name cannot exceed 100 characters")]
    public required string FirstName { get; init; }

    [Required(ErrorMessage = "Last name is required")]
    [StringLength(100, ErrorMessage = "Last name cannot exceed 100 characters")]
    public required string LastName { get; init; }

    /// <summary>
    /// The password to set for the new account. Required in password-based mode (enforced by the service);
    /// omitted in passwordless-only mode, where the account is created without a password.
    /// </summary>
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    public string? Password { get; init; }
}
