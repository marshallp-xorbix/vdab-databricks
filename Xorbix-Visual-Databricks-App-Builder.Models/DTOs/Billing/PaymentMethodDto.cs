namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents a saved customer payment method.
/// </summary>
public class PaymentMethodDto
{
    /// <summary>
    /// Stripe payment method identifier.
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Card brand (for example: visa, mastercard).
    /// </summary>
    public required string Brand { get; init; }

    /// <summary>
    /// Last four digits of the card.
    /// </summary>
    public required string Last4 { get; init; }

    /// <summary>
    /// Expiration month.
    /// </summary>
    public int ExpMonth { get; init; }

    /// <summary>
    /// Expiration year.
    /// </summary>
    public int ExpYear { get; init; }

    /// <summary>
    /// Indicates whether this is the customer's default payment method.
    /// </summary>
    public bool IsDefault { get; init; }
}
