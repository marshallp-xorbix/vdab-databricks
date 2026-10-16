namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Extended user profile information for self-service account settings.
/// Inherits core identity fields from <see cref="UserInfo"/> and adds
/// security settings, notification preferences, and account metadata.
/// </summary>
public class UserProfileResponse : UserInfo
{
    public string? PhoneNumber { get; init; }
    public bool PhoneNumberConfirmed { get; init; }
    public bool EmailConfirmed { get; init; }
    public bool TwoFactorEnabled { get; init; }
    public bool UsePasswordlessLogin { get; init; }
    public bool EmailNotificationsEnabled { get; init; }
    public bool WorkflowNotificationsEnabled { get; init; }
    public DateTime CreatedOn { get; init; }
    public DateTime? LastLoginAt { get; init; }

    /// <summary>
    /// The user's role within their current tenant (from <c>UserTenantMembership.Role</c>),
    /// e.g. "Admin", "Developer". Distinct from the global Identity roles in
    /// <see cref="UserInfo.Roles"/>. Null when the user has no active tenant membership.
    /// </summary>
    public string? TenantRole { get; init; }

    /// <summary>
    /// The identifier of the user's current active tenant (from <c>UserTenantMembership.TenantId</c>).
    /// Used by the client to scope tenant-admin views and to distinguish tenant-owned users from
    /// guests. Null when the user has no active tenant membership.
    /// </summary>
    public Guid? TenantId { get; init; }
}
