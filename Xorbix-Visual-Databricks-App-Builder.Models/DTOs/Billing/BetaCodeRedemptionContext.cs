using Xorbix_Visual_Databricks_App_Builder.Models.Billing;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Internal resolution of a validated beta code used to create a no-card trial subscription.
/// Exactly one of <see cref="TrialEndDate"/> or <see cref="TrialPeriodDays"/> drives the
/// trial length, with <see cref="TrialEndDate"/> taking precedence when both are set.
/// </summary>
public class BetaCodeRedemptionContext
{
    /// <summary>
    /// Identifier of the redeemed beta code.
    /// </summary>
    public required Guid BetaCodeId { get; init; }

    /// <summary>
    /// Customer-facing beta code string.
    /// </summary>
    public required string Code { get; init; }

    /// <summary>
    /// Subscription tier granted by the code (Individual or Team).
    /// </summary>
    public required string Tier { get; init; }

    /// <summary>
    /// Billing interval for the subscription once it converts to paid.
    /// </summary>
    public BillingInterval BillingInterval { get; init; } = BillingInterval.Monthly;

    /// <summary>
    /// Trial length in days, measured from redemption. Ignored when <see cref="TrialEndDate"/> is set.
    /// </summary>
    public int? TrialPeriodDays { get; init; }

    /// <summary>
    /// Absolute UTC timestamp at which the trial ends.
    /// </summary>
    public DateTimeOffset? TrialEndDate { get; init; }
}
