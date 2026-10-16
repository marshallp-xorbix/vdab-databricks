using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents a user's membership in a tenant with their tenant-specific role.
/// Supports multi-tenant model where users can belong to multiple tenants.
/// </summary>
public class UserTenantMembership : TrackableEntity
{
    /// <summary>
    /// Primary key for the membership record.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    /// <summary>
    /// Foreign key to the user.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Foreign key to the tenant.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// The user's role within this specific tenant.
    /// Values: "Administrator" (global), "Admin" (TenantAdmin), "Developer".
    /// </summary>
    [Required]
    [MaxLength(50)]
    public required string Role { get; set; }

    /// <summary>
    /// Indicates if this is the user's default tenant.
    /// Only one membership per user can have IsDefault = true.
    /// </summary>
    public bool IsDefault { get; set; } = false;

    /// <summary>
    /// Timestamp of the user's last access to this tenant.
    /// Used to determine which tenant to select on login.
    /// </summary>
    public DateTime? LastAccessedAt { get; set; }

    /// <summary>
    /// Timestamp when the user joined this tenant.
    /// </summary>
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Membership lifecycle within this tenant (Active / Suspended / Ended).
    /// Ended rows also have <see cref="TrackableEntity.DeletedOn"/> set.
    /// </summary>
    public MembershipStatus Status { get; set; } = MembershipStatus.Active;

    /// <summary>
    /// Navigation property for the user.
    /// </summary>
    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser? User { get; set; }

    /// <summary>
    /// Navigation property for the tenant.
    /// </summary>
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? Tenant { get; set; }
}
