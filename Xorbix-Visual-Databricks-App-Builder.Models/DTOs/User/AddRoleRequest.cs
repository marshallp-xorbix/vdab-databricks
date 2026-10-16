namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for adding a new role.
/// </summary>
public class AddRoleRequest
{
    /// <summary>
    /// The name of the role to create.
    /// </summary>
    public required string RoleName { get; set; }
}
