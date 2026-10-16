using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Canonical Stripe subscription status string constants as persisted on
/// <c>Tenant.SubscriptionStatus</c>. Use these instead of hard-coded status literals.
/// </summary>
[ExcludeFromCodeCoverage]
public static class SubscriptionStatusNames
{
    public const string Active = "active";
    public const string Trialing = "trialing";
    public const string PastDue = "past_due";
    public const string Paused = "paused";
    public const string Canceled = "canceled";
    public const string Incomplete = "incomplete";
    public const string IncompleteExpired = "incomplete_expired";
    public const string Unpaid = "unpaid";
    public const string None = "none";

    /// <summary>
    /// Statuses that lock the account: the tenant's data is preserved but creating or
    /// publishing resources is blocked until the subscription becomes usable again
    /// (for example, a paused no-card trial resumes after a payment method is added).
    /// </summary>
    public static readonly IReadOnlySet<string> LockedStatuses =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { Paused };
}
