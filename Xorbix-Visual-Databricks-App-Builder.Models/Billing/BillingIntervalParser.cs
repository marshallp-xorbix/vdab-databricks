namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Parses billing-interval strings into the canonical <see cref="BillingInterval"/> value,
/// accepting both the client UI vocabulary ("monthly"/"annual") and the enum names
/// ("Monthly"/"Yearly"). Comparison is case- and whitespace-insensitive.
/// </summary>
/// <remarks>
/// The pricing UI uses "monthly"/"annual" while the backend enum uses "Monthly"/"Yearly",
/// so a plain <see cref="System.Enum.TryParse{TEnum}(string, bool, out TEnum)"/> rejects the
/// "annual" value the client sends. Routing every parse site through this helper keeps the two
/// vocabularies reconciled in one place.
/// </remarks>
public static class BillingIntervalParser
{
    /// <summary>
    /// Attempts to parse <paramref name="value"/> into a <see cref="BillingInterval"/>.
    /// Recognizes "monthly"/"month" as <see cref="BillingInterval.Monthly"/> and
    /// "annual"/"annually"/"yearly"/"year" as <see cref="BillingInterval.Yearly"/>.
    /// </summary>
    /// <param name="value">Raw interval string from API input or stored state.</param>
    /// <param name="interval">The parsed interval when the method returns <c>true</c>.</param>
    /// <returns><c>true</c> when <paramref name="value"/> is a recognized interval; otherwise <c>false</c>.</returns>
    public static bool TryParse(string? value, out BillingInterval interval)
    {
        interval = BillingInterval.Monthly;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        switch (value.Trim().ToLowerInvariant())
        {
            case "monthly":
            case "month":
                interval = BillingInterval.Monthly;
                return true;
            case "annual":
            case "annually":
            case "yearly":
            case "year":
                interval = BillingInterval.Yearly;
                return true;
            default:
                return false;
        }
    }
}
