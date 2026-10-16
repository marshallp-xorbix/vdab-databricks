using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Request for a global administrator to add an existing user to a tenant.
/// </summary>
public class AddTenantMemberRequest
{
    /// <summary>
    /// The user to add to the tenant.
    /// </summary>
    [Required]
    public required Guid UserId { get; init; }

    /// <summary>
    /// The tenant role to assign (for example "Admin" or "Developer").
    /// </summary>
    [Required]
    public required string Role { get; init; }
}
