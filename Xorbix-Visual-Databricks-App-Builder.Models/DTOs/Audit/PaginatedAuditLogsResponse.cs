namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;

/// <summary>
/// Cursor-paginated response for audit log listings.
/// </summary>
public class PaginatedAuditLogsResponse
{
    /// <summary>
    /// The audit log entries in the current page, newest-first.
    /// </summary>
    public required IEnumerable<AuditLogDto> Items { get; init; }

    /// <summary>
    /// Opaque cursor for the next page. Null when there are no further entries.
    /// Clients should pass this back as the <c>cursor</c> query parameter to advance.
    /// </summary>
    public string? NextCursor { get; init; }

    /// <summary>
    /// Number of records returned for this page (echoed for client convenience).
    /// </summary>
    public required int Take { get; init; }
}
