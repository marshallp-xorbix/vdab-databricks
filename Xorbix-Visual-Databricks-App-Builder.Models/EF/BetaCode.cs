using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using BillingIntervalOption = Xorbix_Visual_Databricks_App_Builder.Models.Billing.BillingInterval;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents an application-managed beta access code. Redeeming a beta code during account
/// setup provisions a Stripe no-card free trial for the granted tier. Beta codes are managed
/// in the VDAB database and are independent of Stripe coupons / promotion codes.
/// </summary>
public class BetaCode : TrackableEntity
{
    /// <summary>
    /// Primary key.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid BetaCodeId { get; set; }

    /// <summary>
    /// Customer-facing code string, normalized to uppercase for case-insensitive lookup.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public required string Code { get; set; }

    /// <summary>
    /// Subscription tier granted by the code (Individual or Team).
    /// </summary>
    [Required]
    [MaxLength(50)]
    public required string Tier { get; set; }

    /// <summary>
    /// Billing interval applied once the trial converts to paid ("Monthly" or "Yearly").
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string BillingInterval { get; set; } = nameof(BillingIntervalOption.Monthly);

    /// <summary>
    /// Trial length in days, measured from redemption. Ignored when <see cref="TrialEndDate"/> is set.
    /// </summary>
    public int? TrialPeriodDays { get; set; }

    /// <summary>
    /// Absolute UTC timestamp at which redeemed trials end. Takes precedence over
    /// <see cref="TrialPeriodDays"/> when both are set.
    /// </summary>
    public DateTimeOffset? TrialEndDate { get; set; }

    /// <summary>
    /// Maximum number of redemptions allowed across all tenants. Null means unlimited.
    /// </summary>
    public int? MaxRedemptions { get; set; }

    /// <summary>
    /// Number of times the code has been redeemed. Incremented atomically on redemption.
    /// </summary>
    public int RedemptionCount { get; set; }

    /// <summary>
    /// Absolute UTC timestamp after which the code can no longer be redeemed. Null means no expiry.
    /// </summary>
    public DateTimeOffset? ExpiresOn { get; set; }

    /// <summary>
    /// Whether the code is currently redeemable. Allows disabling a code without deleting it.
    /// </summary>
    public bool IsActive { get; set; } = true;
}
