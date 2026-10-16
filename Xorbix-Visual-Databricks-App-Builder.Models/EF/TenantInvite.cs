using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents an outstanding or historical invitation for an external email address to
/// join a tenant. Tokens are stored as a SHA-256 hash; the raw token is only ever returned
/// to the inviter (or embedded in an invite email) at creation time.
/// </summary>
public class TenantInvite : TrackableEntity
{
    /// <summary>
    /// Primary key.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid Id { get; set; }

    /// <summary>
    /// Tenant the invite is scoped to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Original email as submitted by the inviter (preserved for display).
    /// </summary>
    [Required]
    [MaxLength(256)]
    public required string Email { get; set; }

    /// <summary>
    /// Normalized (uppercase) form of <see cref="Email"/> used for uniqueness/lookup.
    /// </summary>
    [Required]
    [MaxLength(256)]
    public required string NormalizedEmail { get; set; }

    /// <summary>
    /// SHA-256 hash (Base64) of the raw invite token. The raw token is never persisted.
    /// </summary>
    [Required]
    [MaxLength(128)]
    public required string TokenHash { get; set; }

    /// <summary>
    /// Absolute UTC timestamp at which the invite token expires.
    /// </summary>
    public DateTime TokenExpiresAt { get; set; }

    /// <summary>
    /// Lifecycle status of the invite. See <see cref="TenantInviteStatuses"/>.
    /// </summary>
    [Required]
    [MaxLength(32)]
    public required string Status { get; set; }

    /// <summary>
    /// User who created the invite.
    /// </summary>
    public Guid InvitedByUserId { get; set; }

    /// <summary>
    /// Timestamp the invite was created (separate from <see cref="TrackableEntity.CreatedOn"/>
    /// to keep audit semantics explicit on this domain entity).
    /// </summary>
    public DateTime InvitedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Timestamp the invite was accepted, if applicable.
    /// </summary>
    public DateTime? AcceptedAt { get; set; }

    /// <summary>
    /// User that accepted the invite, if applicable.
    /// </summary>
    public Guid? AcceptedByUserId { get; set; }

    /// <summary>
    /// Seat assigned during acceptance, if applicable. Allows correlating an invite
    /// to the seat it consumed.
    /// </summary>
    public Guid? ResultingSeatId { get; set; }

    /// <summary>
    /// Snapshot at invite-creation time indicating the inviter was warned that accepting
    /// this invite would require purchasing additional seats. Persisted so the warning
    /// shown at invite time can be reconstructed for audit purposes.
    /// </summary>
    public bool RequiresSeatPurchase { get; set; }

    /// <summary>
    /// Navigation property for the tenant.
    /// </summary>
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? Tenant { get; set; }
}
