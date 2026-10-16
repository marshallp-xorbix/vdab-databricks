namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// DTO representing a single subscription history event for a tenant.
/// </summary>
public class SubscriptionHistoryDto
{
    /// <summary>
    /// Primary key for the subscription history record.
    /// </summary>
    public required int SubscriptionHistoryId { get; init; }

    /// <summary>
    /// Tenant identifier this event belongs to.
    /// </summary>
    public required Guid TenantId { get; init; }

    /// <summary>
    /// Event type: "Created", "Upgraded", "Downgraded", "Renewed", "Cancelled", "Payment".
    /// </summary>
    public required string EventType { get; init; }

    /// <summary>
    /// Subscription tier at the time of the event.
    /// </summary>
    public required string SubscriptionTier { get; init; }

    /// <summary>
    /// Billing cycle at the time of the event.
    /// </summary>
    public required string BillingCycle { get; init; }

    /// <summary>
    /// Amount charged or refunded, when applicable.
    /// </summary>
    public decimal? Amount { get; init; }

    /// <summary>
    /// Currency code (e.g., "USD").
    /// </summary>
    public required string Currency { get; init; }

    /// <summary>
    /// External transaction identifier from the billing provider.
    /// </summary>
    public string? ExternalTransactionId { get; init; }

    /// <summary>
    /// Stripe invoice identifier associated with this event.
    /// </summary>
    public string? StripeInvoiceId { get; init; }

    /// <summary>
    /// Stripe payment intent identifier associated with this event.
    /// </summary>
    public string? StripePaymentIntentId { get; init; }

    /// <summary>
    /// Payment status: "Pending", "Completed", "Failed", "Refunded".
    /// </summary>
    public string? PaymentStatus { get; init; }

    /// <summary>
    /// Stripe event identifier that produced this record.
    /// </summary>
    public string? StripeEventId { get; init; }

    /// <summary>
    /// Additional notes or metadata about this event.
    /// </summary>
    public string? Notes { get; init; }

    /// <summary>
    /// Timestamp when the event occurred.
    /// </summary>
    public required DateTime EventDate { get; init; }
}
