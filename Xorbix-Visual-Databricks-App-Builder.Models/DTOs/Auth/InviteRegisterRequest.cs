using System.ComponentModel.DataAnnotations;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Request used when a new user is being provisioned as part of accepting a tenant invite.
/// Clicking the invite link proves email ownership, so the user is created with
/// <c>EmailConfirmed=true</c> and no confirmation or welcome emails are sent.
/// </summary>
public class InviteRegisterRequest : CreateUserRequest
{
    /// <summary>
    /// The password to set for the new user. Optional: in passwordless-only mode the user is provisioned
    /// without a password, so this is left null.
    /// </summary>
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    public string? Password { get; init; }
}
