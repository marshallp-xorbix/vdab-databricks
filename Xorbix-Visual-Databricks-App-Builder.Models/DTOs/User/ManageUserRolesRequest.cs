namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for managing user roles (add/remove).
/// </summary>
public class ManageUserRolesRequest
{
    /// <summary>
    /// Gets or sets the roles to add to the user.
    /// Valid roles: Administrator, Admin, Developer
    /// </summary>
    public IList<string>? RolesToAdd { get; init; }

    /// <summary>
    /// Gets or sets the roles to remove from the user.
    /// Valid roles: Administrator, Admin, Developer
    /// </summary>
    public IList<string>? RolesToRemove { get; init; }
}
