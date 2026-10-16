namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;

/// <summary>
/// Filter + pagination criteria for querying audit logs.
/// All filter fields are optional; combine to narrow the result set.
/// Pagination is cursor-based — see <see cref="Cursor"/> — so callers do not
/// supply an offset.
/// </summary>
public class AuditLogQuery
{
    /// <summary>
    /// Restrict results to a single user.
    /// </summary>
    public Guid? UserId { get; init; }

    /// <summary>
    /// Restrict results to a single tenant.
    /// </summary>
    public Guid? TenantId { get; init; }

    /// <summary>
    /// Restrict results to one or more action types (e.g., "Login", "Logout", "Update").
    /// Matched case-insensitively against <c>AuditLog.ActionType</c>.
    /// </summary>
    public IReadOnlyList<string>? ActionTypes { get; init; }

    /// <summary>
    /// Restrict results to entries at or after this timestamp (UTC).
    /// </summary>
    public DateTime? StartDate { get; init; }

    /// <summary>
    /// Restrict results to entries at or before this timestamp (UTC).
    /// </summary>
    public DateTime? EndDate { get; init; }

    /// <summary>
    /// Restrict results to one or more severity levels (e.g., "Info", "Warning", "Critical").
    /// Matched case-insensitively against <c>AuditLog.Severity</c>.
    /// </summary>
    public IReadOnlyList<string>? Severities { get; init; }

    /// <summary>
    /// Whether to include archived entries. Defaults to false.
    /// </summary>
    public bool IncludeArchived { get; init; }

    /// <summary>
    /// Position from a previous page's <c>NextCursor</c>. Null fetches the first page.
    /// Cursors are scoped to a specific filter set; changing filters resets to null.
    /// </summary>
    public AuditLogCursor? Cursor { get; init; }

    /// <summary>
    /// Number of records to return for the page. Defaults to 25, clamped to 1..200 by the service.
    /// </summary>
    public int Take { get; init; } = 25;
}
