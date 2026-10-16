namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;

/// <summary>
/// Projected, client-safe representation of an audit log entry.
/// Includes user + tenant display fields so clients do not need to make follow-up requests.
/// </summary>
public class AuditLogDto
{
    /// <summary>
    /// Primary key of the audit log entry.
    /// </summary>
    public required long AuditLogId { get; init; }

    /// <summary>
    /// Tenant the action occurred under. Null for platform-level or post-purge tombstone rows.
    /// </summary>
    public Guid? TenantId { get; init; }

    /// <summary>
    /// Display name of the tenant, when joinable.
    /// </summary>
    public string? TenantDisplayName { get; init; }

    /// <summary>
    /// User who performed the action, when present.
    /// </summary>
    public Guid? UserId { get; init; }

    /// <summary>
    /// First + last name of the acting user, when joinable.
    /// </summary>
    public string? UserFullName { get; init; }

    /// <summary>
    /// Email of the acting user, when joinable.
    /// </summary>
    public string? UserEmail { get; init; }

    /// <summary>
    /// Whether this entry has been archived.
    /// </summary>
    public required bool IsArchived { get; init; }

    /// <summary>
    /// Action type (e.g., "Login", "Logout", "Update").
    /// </summary>
    public required string ActionType { get; init; }

    /// <summary>
    /// Entity type affected, when applicable.
    /// </summary>
    public string? EntityType { get; init; }

    /// <summary>
    /// Entity identifier affected, when applicable.
    /// </summary>
    public string? EntityId { get; init; }

    /// <summary>
    /// Human-readable description of the action.
    /// </summary>
    public required string Description { get; init; }

    /// <summary>
    /// Additional metadata (typically JSON-encoded), when present.
    /// </summary>
    public string? Metadata { get; init; }

    /// <summary>
    /// IP address from which the action originated, when captured.
    /// </summary>
    public string? IpAddress { get; init; }

    /// <summary>
    /// User agent that performed the action, when captured.
    /// </summary>
    public string? UserAgent { get; init; }

    /// <summary>
    /// Severity level: "Info", "Warning", "Error", "Critical".
    /// </summary>
    public required string Severity { get; init; }

    /// <summary>
    /// When the action occurred (UTC).
    /// </summary>
    public required DateTime Timestamp { get; init; }
}
