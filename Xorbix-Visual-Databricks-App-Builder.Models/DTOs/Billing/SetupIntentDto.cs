namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents setup intent data required by Stripe.js.
/// </summary>
public class SetupIntentDto
{
    /// <summary>
    /// Stripe setup intent client secret.
    /// </summary>
    public required string ClientSecret { get; init; }
}
