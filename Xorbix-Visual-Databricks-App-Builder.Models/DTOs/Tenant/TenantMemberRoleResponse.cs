namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Represents a user's role within a specific tenant, returned when a tenant
/// administrator views or updates the membership role of one of their members.
/// </summary>
public class TenantMemberRoleResponse
{
    /// <summary>
    /// The member user's unique identifier.
    /// </summary>
    public required Guid UserId { get; init; }

    /// <summary>
    /// The tenant the membership role applies to.
    /// </summary>
    public required Guid TenantId { get; init; }

    /// <summary>
    /// The user's role within the tenant (for example "Admin" or "Developer").
    /// </summary>
    public required string Role { get; init; }

    /// <summary>
    /// Membership status for this tenant: Active, Suspended, or Ended.
    /// </summary>
    public required string Status { get; init; }
}
