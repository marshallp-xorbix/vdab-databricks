using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Request to change a member's role within the caller's current tenant.
/// </summary>
public class UpdateTenantMemberRoleRequest
{
    /// <summary>
    /// The new tenant role to assign (for example "Admin" or "Developer").
    /// </summary>
    [Required]
    public required string Role { get; init; }
}
