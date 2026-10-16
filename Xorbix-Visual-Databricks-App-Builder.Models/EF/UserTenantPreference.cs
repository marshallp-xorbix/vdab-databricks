using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Per-user, per-tenant JSON preferences store for feature-specific settings.
/// </summary>
public class UserTenantPreference : TrackableEntity
{
    /// <summary>
    /// Primary key for the preference record.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    /// <summary>
    /// Foreign key referencing the user.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Foreign key referencing the tenant.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// JSON object of preference key/value pairs.
    /// </summary>
    [Required]
    [MaxLength(8192)]
    public string PreferencesJson { get; set; } = "{}";

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
