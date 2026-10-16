namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents an invoice returned from Stripe.
/// </summary>
public class InvoiceDto
{
    /// <summary>
    /// Stripe invoice identifier.
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Invoice amount in major currency units.
    /// </summary>
    public decimal Amount { get; init; }

    /// <summary>
    /// ISO currency code.
    /// </summary>
    public required string Currency { get; init; }

    /// <summary>
    /// Stripe invoice status (paid, open, draft, uncollectible, void).
    /// </summary>
    public required string Status { get; init; }

    /// <summary>
    /// Invoice creation timestamp.
    /// </summary>
    public DateTime Created { get; init; }

    /// <summary>
    /// Link to Stripe-hosted PDF invoice.
    /// </summary>
    public string? PdfUrl { get; init; }

    /// <summary>
    /// Link to Stripe-hosted invoice page.
    /// </summary>
    public string? HostedInvoiceUrl { get; init; }
}
