namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Reports;

/// <summary>
/// Aggregated platform statistics returned by the reports endpoint.
/// </summary>
public class ReportsStatsResponse
{
    /// <summary>
    /// Total number of active (non-deleted, <c>IsActive == true</c>) users in the platform.
    /// </summary>
    public required int ActiveUsersCount { get; init; }

    /// <summary>
    /// Number of users created in the last 30 days (non-deleted).
    /// </summary>
    public required int NewUsersLast30DaysCount { get; init; }

    /// <summary>
    /// Number of tenant invites still in the pending state.
    /// </summary>
    public required int PendingInvitesCount { get; init; }

    /// <summary>
    /// Number of non-deleted apps.
    /// </summary>
    public required int ActiveAppsCount { get; init; }

    /// <summary>
    /// Number of non-deleted Databricks workspace connections.
    /// </summary>
    public required int ActiveWorkspacesCount { get; init; }

    /// <summary>
    /// Total number of active (non-deleted, <c>IsActive == true</c>) tenants in the platform.
    /// </summary>
    public required int ActiveTenantsCount { get; init; }

    /// <summary>
    /// Number of tenants created in the last 30 days (non-deleted).
    /// </summary>
    public required int NewTenantsLast30DaysCount { get; init; }

    /// <summary>
    /// Placeholder system health indicator. Currently hard-coded to "Operational".
    /// </summary>
    // TODO: Replace with real health probe aggregation once a health service exists.
    public required string SystemHealthStatus { get; init; }

    /// <summary>
    /// UTC timestamp when the snapshot was generated.
    /// </summary>
    public required DateTime GeneratedAt { get; init; }
}
