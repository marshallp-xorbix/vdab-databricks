namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents a line item in an invoice or invoice preview.
/// </summary>
public class InvoiceLineItemDto
{
    /// <summary>
    /// Human-readable line description from Stripe.
    /// </summary>
    public required string Description { get; init; }

    /// <summary>
    /// Line amount in major currency units.
    /// </summary>
    public decimal Amount { get; init; }

    /// <summary>
    /// ISO currency code.
    /// </summary>
    public required string Currency { get; init; }

    /// <summary>
    /// Quantity associated with this line item.
    /// </summary>
    public int Quantity { get; init; }
}
