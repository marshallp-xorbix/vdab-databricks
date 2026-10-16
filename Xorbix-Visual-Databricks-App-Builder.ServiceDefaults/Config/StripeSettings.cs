using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

[ExcludeFromCodeCoverage]
public sealed class TierPriceConfig
{
    public string Monthly { get; set; } = string.Empty;
    public string Yearly { get; set; } = string.Empty;
}

[ExcludeFromCodeCoverage]
public sealed class StripePriceIds
{
    public TierPriceConfig Individual { get; set; } = new();
    public TierPriceConfig Team { get; set; } = new();
    public TierPriceConfig Enterprise { get; set; } = new();
}

[ExcludeFromCodeCoverage]
public sealed class StripeSettings
{
    public const string ConfigurationSectionName = "Stripe";

    public string SecretKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string PublishableKey { get; set; } = string.Empty;
    public StripePriceIds PriceIds { get; set; } = new();
}
