using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// DTO for reading and updating Stripe invoice customer details.
/// </summary>
public class CustomerDetailsDto
{
    /// <summary>
    /// Name to display on Stripe invoices.
    /// </summary>
    [MaxLength(200)]
    public string InvoiceName { get; set; } = string.Empty;

    /// <summary>
    /// Email to use for Stripe invoice delivery.
    /// </summary>
    [MaxLength(255)]
    [EmailAddress]
    public string InvoiceEmail { get; set; } = string.Empty;
}
