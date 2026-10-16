using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Tracks subscription changes and billing history for a tenant.
/// </summary>
public class SubscriptionHistory : TrackableEntity
{
    /// <summary>
    /// Primary key for the subscription history record.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int SubscriptionHistoryId { get; set; }

    /// <summary>
    /// Foreign key to the tenant.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property for the tenant.
    /// </summary>
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? Tenant { get; set; }

    /// <summary>
    /// Type of event: "Created", "Upgraded", "Downgraded", "Renewed", "Cancelled", "Payment".
    /// </summary>
    [Required]
    [MaxLength(50)]
    public required string EventType { get; set; }

    /// <summary>
    /// Subscription tier at the time of this event.
    /// </summary>
    [Required]
    [MaxLength(50)]
    public required string SubscriptionTier { get; set; }

    /// <summary>
    /// Billing cycle at the time of this event.
    /// </summary>
    [MaxLength(20)]
    public string BillingCycle { get; set; } = "Monthly";

    /// <summary>
    /// Amount charged or refunded (if applicable).
    /// </summary>
    [Column(TypeName = "decimal(10,2)")]
    public decimal? Amount { get; set; }

    /// <summary>
    /// Currency code (e.g., "USD").
    /// </summary>
    [MaxLength(3)]
    public string Currency { get; set; } = "USD";

    /// <summary>
    /// External transaction or invoice ID from billing provider.
    /// </summary>
    [MaxLength(255)]
    public string? ExternalTransactionId { get; set; }

    /// <summary>
    /// Stripe invoice ID associated with this billing event.
    /// </summary>
    [MaxLength(255)]
    public string? StripeInvoiceId { get; set; }

    /// <summary>
    /// Stripe payment intent ID associated with this billing event.
    /// </summary>
    [MaxLength(255)]
    public string? StripePaymentIntentId { get; set; }

    /// <summary>
    /// Payment status: "Pending", "Completed", "Failed", "Refunded".
    /// </summary>
    [MaxLength(50)]
    public string? PaymentStatus { get; set; }

    /// <summary>
    /// Stripe event ID that triggered this history record (for correlation with StripeEventLog).
    /// </summary>
    [MaxLength(255)]
    public string? StripeEventId { get; set; }

    /// <summary>
    /// Additional notes or metadata about this event.
    /// </summary>
    [MaxLength(1000)]
    public string? Notes { get; set; }

    /// <summary>
    /// When this subscription event occurred.
    /// </summary>
    public DateTime EventDate { get; set; } = DateTime.UtcNow;
}
