using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Canonical subscription tier name constants.
/// Values are derived from the <see cref="SubscriptionTier"/> enum to prevent drift.
/// Use these constants for string comparisons instead of hard-coded tier name literals.
/// </summary>
[ExcludeFromCodeCoverage]
public static class SubscriptionTierNames
{
    public const string Trial = nameof(SubscriptionTier.Trial);
    public const string Individual = nameof(SubscriptionTier.Individual);
    public const string Team = nameof(SubscriptionTier.Team);
    public const string Enterprise = nameof(SubscriptionTier.Enterprise);
}
