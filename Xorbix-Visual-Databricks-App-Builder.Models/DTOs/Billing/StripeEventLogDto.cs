namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents a Stripe event log record for diagnostics.
/// </summary>
public class StripeEventLogDto
{
    /// <summary>
    /// Internal log identifier.
    /// </summary>
    public required long Id { get; init; }

    /// <summary>
    /// Stripe event identifier.
    /// </summary>
    public required string StripeEventId { get; init; }

    /// <summary>
    /// Stripe event type.
    /// </summary>
    public required string EventType { get; init; }

    /// <summary>
    /// Time the event was processed.
    /// </summary>
    public required DateTime ProcessedAt { get; init; }

    /// <summary>
    /// Indicates whether processing succeeded.
    /// </summary>
    public required bool Success { get; init; }

    /// <summary>
    /// Failure details when processing did not succeed.
    /// </summary>
    public string? ErrorMessage { get; init; }

    /// <summary>
    /// Stripe customer identifier associated with the event.
    /// </summary>
    public string? CustomerId { get; init; }

    /// <summary>
    /// User-friendly summary of what happened (e.g. "Payment Method Saved: Visa ******1234").
    /// </summary>
    public string? DetailSummary { get; init; }
}