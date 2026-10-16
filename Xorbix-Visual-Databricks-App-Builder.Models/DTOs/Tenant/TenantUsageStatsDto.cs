namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// DTO containing usage statistics for a tenant, including current counts and subscription limits.
/// </summary>
public class TenantUsageStatsDto
{
    /// <summary>
    /// The tenant's unique identifier.
    /// </summary>
    public required Guid TenantId { get; init; }

    /// <summary>
    /// The tenant's display name.
    /// </summary>
    public required string DisplayName { get; init; }

    /// <summary>
    /// Current subscription tier for this tenant.
    /// </summary>
    public required string SubscriptionTier { get; init; }

    /// <summary>
    /// Current subscription status for this tenant (for example: active, trialing, paused).
    /// </summary>
    public string SubscriptionStatus { get; init; } = string.Empty;

    /// <summary>
    /// Current number of users in the tenant.
    /// </summary>
    public required int UserCount { get; init; }

    /// <summary>
    /// Current number of apps owned by the tenant.
    /// </summary>
    public required int AppCount { get; init; }

    /// <summary>
    /// Current number of Databricks connections for the tenant.
    /// </summary>
    public required int ConnectionCount { get; init; }

    /// <summary>
    /// Maximum number of users allowed by the subscription.
    /// </summary>
    public required int MaxUsers { get; init; }

    /// <summary>
    /// Maximum number of published apps allowed by the subscription.
    /// </summary>
    public required int MaxPublishedApps { get; init; }

    /// <summary>
    /// Maximum number of workspace connections allowed by the subscription.
    /// </summary>
    public required int MaxWorkspaceConnections { get; init; }
}
