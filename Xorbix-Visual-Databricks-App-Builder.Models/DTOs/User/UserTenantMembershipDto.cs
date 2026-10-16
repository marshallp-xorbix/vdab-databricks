namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Compact membership summary attached to user list rows so clients can show
/// a user's owning tenant (and full membership list for tooltips) without an
/// additional round trip. Distinct from <c>TenantMembershipDto</c>, which is
/// shaped for the per-user tenant switcher.
/// </summary>
public class UserTenantMembershipDto
{
    /// <summary>
    /// Tenant identifier.
    /// </summary>
    public required Guid TenantId { get; init; }

    /// <summary>
    /// Tenant display name for table cells + tooltips.
    /// </summary>
    public required string TenantDisplayName { get; init; }

    /// <summary>
    /// The user's role within this tenant (e.g., "Admin", "Developer").
    /// </summary>
    public required string Role { get; init; }

    /// <summary>
    /// Whether this is the user's default tenant membership.
    /// </summary>
    public required bool IsDefault { get; init; }

    /// <summary>
    /// Whether this is the user's primary/home tenant highlight
    /// (mirrors <see cref="IsDefault"/> after Phase 4).
    /// </summary>
    public required bool IsPrimary { get; init; }

    /// <summary>
    /// Whether the user is the owner of this tenant
    /// (matches <c>Tenant.OwnerId</c>).
    /// </summary>
    public required bool IsOwner { get; init; }

    /// <summary>
    /// Membership status for this tenant (<c>Active</c>, <c>Suspended</c>, or <c>Ended</c>).
    /// </summary>
    public string? Status { get; init; }
}
