using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Resolves subscription tier limits and Stripe price mappings.
/// </summary>
public interface ISubscriptionTierService
{
    /// <summary>
    /// Builds the public plan catalog (display pricing, limits, and trial terms) from configuration.
    /// </summary>
    /// <remarks>
    /// Returns the self-service and sales-assisted tiers (Individual, Team, Enterprise) in display
    /// order. Display prices come from local configuration kept in sync with Stripe. A limit value of
    /// <c>0</c> indicates unlimited.
    /// </remarks>
    /// <returns>The configured plans.</returns>
    Result<IReadOnlyList<PlanDto>> GetPlans();

    /// <summary>
    /// Gets configured limits for a tier.
    /// </summary>
    /// <param name="tier">Tier name (for example: Trial, Individual, Team, Enterprise).</param>
    /// <returns>Tier limits if found; otherwise, a failure result.</returns>
    Result<SubscriptionTierLimits> GetTierLimits(string tier);

    /// <summary>
    /// Resolves the effective per-tenant feature limits for a tier given its current
    /// subscription status and active seat count.
    /// </summary>
    /// <remarks>
    /// While the status is trialing and the tier offers a trial, the trial's flat limits apply.
    /// Otherwise, per-seat tiers scale their limits by the seat count and flat tiers use their
    /// configured maximums. A value of <c>0</c> indicates unlimited.
    /// </remarks>
    /// <param name="tier">Tier name (for example: Individual, Team, Enterprise).</param>
    /// <param name="status">Current subscription status (for example: active, trialing).</param>
    /// <param name="seatCount">Active seat count used for per-seat scaling.</param>
    /// <returns>The effective limits if the tier is valid; otherwise, a failure result.</returns>
    Result<EffectiveTierLimits> ResolveEffectiveLimits(string tier, string status, int seatCount);

    /// <summary>
    /// Gets the Stripe Price ID for a tier and billing interval.
    /// </summary>
    /// <param name="tier">Tier name (for example: Trial, Individual, Team).</param>
    /// <param name="interval">Billing interval (Monthly or Yearly).</param>
    /// <returns>Stripe Price ID if available; otherwise, a failure result.</returns>
    Result<string> GetTierPriceId(string tier, BillingInterval interval);

    /// <summary>
    /// Resolves tier and billing interval from a Stripe Price ID.
    /// </summary>
    /// <param name="priceId">Stripe Price ID.</param>
    /// <returns>Resolved tier and interval if found; otherwise, a failure result.</returns>
    Result<(SubscriptionTier Tier, BillingInterval Interval)> GetTierFromPriceId(string priceId);

    /// <summary>
    /// Determines whether the tier supports seat-variable pricing.
    /// </summary>
    /// <param name="tier">Tier name (for example: Trial, Individual, Team, Enterprise).</param>
    /// <returns>True when the tier is seat-variable.</returns>
    bool IsPerSeatTier(string tier);
}