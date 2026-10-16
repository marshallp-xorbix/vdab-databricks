using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Normalizes subscription tier strings to canonical enum names.
/// </summary>
[ExcludeFromCodeCoverage]
public static class SubscriptionTierNormalizer
{
    /// <summary>
    /// Normalizes a tier string to a canonical tier name used by billing services.
    /// </summary>
    /// <param name="tier">Raw tier value from API input or tenant state.</param>
    /// <returns>Canonical tier name.</returns>
    public static string Normalize(string tier)
    {
        if (string.IsNullOrWhiteSpace(tier))
        {
            return SubscriptionTierNames.Individual;
        }

        if (Enum.TryParse(tier, ignoreCase: true, out SubscriptionTier parsedTier))
        {
            if (parsedTier == SubscriptionTier.None)
            {
                return SubscriptionTierNames.Individual;
            }

            return parsedTier.ToString();
        }

        return tier;
    }
}
