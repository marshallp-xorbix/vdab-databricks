using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for adding a new user (admin function).
/// Extends registration without requiring a password and allows role assignment.
/// </summary>
public class AddUserRequest : CreateUserRequest
{
    /// <summary>
    /// Gets or sets the roles to assign to the user.
    /// Valid roles: Administrator, TenantAdmin, Developer
    /// </summary>
    [Required(ErrorMessage = "At least one role is required")]
    [MinLength(1, ErrorMessage = "At least one role must be assigned")]
    public required IList<string> Roles { get; init; }

    /// <summary>
    /// Gets or sets whether to send a welcome email with password setup instructions.
    /// Defaults to true.
    /// </summary>
    public bool SendWelcomeEmail { get; init; } = true;

    /// <summary>
    /// Choose if user is allowed to use passwordless login. If false, user must set a password to login.
    /// Defaults to false.
    /// </summary>
    public bool UsePasswordlessLogin { get; init; } = false;

    public Guid? TenantId { get; init; }
}
