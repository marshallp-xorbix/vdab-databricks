namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Paginated response for invoice listings.
/// </summary>
public class PaginatedInvoicesResponse
{
    /// <summary>
    /// Invoices included in the current page.
    /// </summary>
    public required IEnumerable<InvoiceDto> Invoices { get; init; }

    /// <summary>
    /// Number of invoice records skipped before this page.
    /// </summary>
    public required int Skip { get; init; }

    /// <summary>
    /// Number of invoice records requested for this page.
    /// </summary>
    public required int Take { get; init; }

    /// <summary>
    /// Indicates whether more invoices are available after this page.
    /// </summary>
    public required bool HasMore { get; init; }
}