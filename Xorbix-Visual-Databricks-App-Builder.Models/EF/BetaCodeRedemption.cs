using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Records a tenant's redemption of a beta code. A tenant may redeem at most one beta code
/// (enforced by a unique index on <see cref="TenantId"/>).
/// </summary>
public class BetaCodeRedemption : TrackableEntity
{
    /// <summary>
    /// Primary key.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid BetaCodeRedemptionId { get; set; }

    /// <summary>
    /// The redeemed beta code.
    /// </summary>
    public Guid BetaCodeId { get; set; }

    /// <summary>
    /// Tenant that redeemed the code.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// User who performed the redemption.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// UTC timestamp of the redemption.
    /// </summary>
    public DateTimeOffset RedeemedOn { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Navigation property for the beta code.
    /// </summary>
    [ForeignKey(nameof(BetaCodeId))]
    public virtual BetaCode? BetaCode { get; set; }

    /// <summary>
    /// Navigation property for the tenant.
    /// </summary>
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? Tenant { get; set; }
}
