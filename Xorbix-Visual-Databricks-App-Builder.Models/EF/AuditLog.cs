using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents an audit log entry for tracking user actions and system events.
/// </summary>
public class AuditLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long AuditLogId { get; set; }
    /// <summary>
    /// Tenant the action occurred under. Null for platform-level or post-purge tombstone rows.
    /// </summary>
    public Guid? TenantId { get; set; }
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? Tenant { get; set; }
    public Guid? UserId { get; set; }
    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser? User { get; set; }
    public bool IsArchived { get; set; }
    /// <summary>
    /// Type of action: "Login", "Logout", "WorkflowCreated", "WorkflowModified", "WorkflowPublished", 
    /// "WorkflowDeleted", "UserInvited", "UserRoleChanged", "ConnectionCreated", "ConnectionModified", 
    /// "ConnectionDeleted", "SubscriptionChanged", etc.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public required string ActionType { get; set; }

    /// <summary>
    /// Entity type affected (e.g., "Workflow", "User", "Connection", "Subscription").
    /// </summary>
    [MaxLength(100)]
    public string? EntityType { get; set; }

    /// <summary>
    /// ID of the entity affected (if applicable).
    /// </summary>
    [MaxLength(100)]
    public string? EntityId { get; set; }

    /// <summary>
    /// Historical ID of the entity affected (if applicable).
    /// </summary>
    [MaxLength(100)]
    public string? HistoricalEntityId { get; set; }

    /// <summary>
    /// Human-readable description of the action.
    /// </summary>
    [Required]
    [MaxLength(1000)]
    public required string Description { get; set; }

    /// <summary>
    /// Additional metadata in JSON format (e.g., before/after values, request details).
    /// </summary>
    [Column(TypeName = "text")]
    public string? Metadata { get; set; }

    /// <summary>
    /// IP address of the user at the time of the action.
    /// </summary>
    [MaxLength(50)]
    public string? IpAddress { get; set; }

    /// <summary>
    /// User agent string from the request.
    /// </summary>
    [MaxLength(500)]
    public string? UserAgent { get; set; }

    /// <summary>
    /// Severity level: see <see cref="AuditSeverities"/>.
    /// </summary>
    [MaxLength(20)]
    public string Severity { get; set; } = "Info";

    /// <summary>
    /// When the action occurred.
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
