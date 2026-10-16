using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents a billable subscription seat for a tenant.
/// </summary>
public class SubscriptionSeat : TrackableEntity
{
    /// <summary>
    /// Primary key for the seat.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid SubscriptionSeatId { get; set; }

    /// <summary>
    /// Foreign key to the tenant that owns this seat.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Foreign key to the assigned user. Null means the seat is unoccupied.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Current seat status: Active, PendingCancellation, or Canceled.
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Active";

    /// <summary>
    /// True when this seat is included by the tier minimum, false when purchased as extra.
    /// </summary>
    public bool IsBundled { get; set; }

    /// <summary>
    /// When the seat became active or was purchased.
    /// </summary>
    public DateTimeOffset SeatStartDate { get; set; }

    /// <summary>
    /// When the seat ends; null means it follows the subscription period.
    /// </summary>
    public DateTimeOffset? SeatEndDate { get; set; }

    /// <summary>
    /// When cancellation was requested.
    /// </summary>
    public DateTimeOffset? CanceledAt { get; set; }

    /// <summary>
    /// When a user was assigned to the seat.
    /// </summary>
    public DateTimeOffset? AssignedAt { get; set; }

    /// <summary>
    /// Navigation property to the owning tenant.
    /// </summary>
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? Tenant { get; set; }

    /// <summary>
    /// Navigation property to the assigned user.
    /// </summary>
    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser? User { get; set; }
}
