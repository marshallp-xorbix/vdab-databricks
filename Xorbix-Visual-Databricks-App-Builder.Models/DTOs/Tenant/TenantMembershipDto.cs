namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Lightweight DTO for tenant membership, used to populate the tenant switcher dropdown.
/// </summary>
public class TenantMembershipDto
{
    /// <summary>
    /// The tenant's unique identifier.
    /// </summary>
    public required Guid TenantId { get; init; }

    /// <summary>
    /// The tenant's system name.
    /// </summary>
    public required string TenantName { get; init; }

    /// <summary>
    /// The tenant's display name.
    /// </summary>
    public required string DisplayName { get; init; }

    /// <summary>
    /// The user's role within this tenant.
    /// </summary>
    public required string Role { get; init; }

    /// <summary>
    /// Whether this is the user's default tenant.
    /// </summary>
    public required bool IsDefault { get; init; }

    /// <summary>
    /// Whether this tenant is the user's currently active tenant.
    /// </summary>
    public required bool IsCurrentTenant { get; init; }
}
