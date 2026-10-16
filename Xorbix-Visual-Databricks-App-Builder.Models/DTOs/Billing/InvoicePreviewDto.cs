namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents an upcoming invoice or proration preview.
/// </summary>
public class InvoicePreviewDto
{
    /// <summary>
    /// Total amount in major currency units.
    /// </summary>
    public decimal Amount { get; init; }

    /// <summary>
    /// ISO currency code.
    /// </summary>
    public required string Currency { get; init; }

    /// <summary>
    /// Itemized breakdown for the preview.
    /// </summary>
    public IList<InvoiceLineItemDto> LineItems { get; init; } = new List<InvoiceLineItemDto>();

    /// <summary>
    /// Proration calculation date.
    /// </summary>
    public DateTime ProrationDate { get; init; }
}
