using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Manages Stripe subscription lifecycle and synchronization to tenant state.
/// </summary>
public interface IStripeSubscriptionService
{
    /// <summary>
    /// Creates a Stripe subscription for the tenant and initializes local seat inventory.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="tier">Requested subscription tier.</param>
    /// <param name="billingInterval">Billing interval (Monthly or Yearly).</param>
    /// <param name="promoCode">Optional promotion code for signup discounts.</param>
    /// <param name="startTrial">When true, start the subscription as a trial if the tier supports one.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Created subscription details.</returns>
    Task<Result<SubscriptionDto>> CreateSubscriptionAsync(
        Guid tenantId,
        string tier,
        string billingInterval,
        string? promoCode = null,
        bool startTrial = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a no-card trial subscription for the tenant from a redeemed beta code.
    /// The subscription starts trialing without a payment method
    /// (<c>payment_method_collection = if_required</c>) and pauses at trial end if no
    /// payment method has been added (<c>missing_payment_method = pause</c>).
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="redemption">Resolved beta code redemption (tier and trial length).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Created subscription details (no payment confirmation secret).</returns>
    Task<Result<SubscriptionDto>> CreateBetaTrialSubscriptionAsync(
        Guid tenantId,
        BetaCodeRedemptionContext redemption,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves the tenant's current subscription details.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Current subscription details.</returns>
    Task<Result<SubscriptionDto>> GetSubscriptionAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates the tenant's subscription tier and reconciles local seat inventory.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="newTier">Target subscription tier.</param>
    /// <param name="billingInterval">Billing interval (Monthly or Yearly).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated subscription details.</returns>
    Task<Result<SubscriptionDto>> UpdateSubscriptionAsync(Guid tenantId, string newTier, string billingInterval, CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels the tenant subscription immediately or at period end.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="immediate">When true, cancel immediately; otherwise cancel at period end.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated subscription details after cancellation request.</returns>
    Task<Result<SubscriptionDto>> CancelSubscriptionAsync(Guid tenantId, bool immediate, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reactivates a subscription that is scheduled to cancel at period end.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated subscription details.</returns>
    Task<Result<SubscriptionDto>> ReactivateSubscriptionAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves an upcoming invoice preview for current subscription or proposed tier change.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="newTier">Optional target tier for proration preview.</param>
    /// <param name="billingInterval">Optional billing interval for proration preview.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Upcoming invoice preview details.</returns>
    Task<Result<InvoicePreviewDto>> GetUpcomingInvoiceAsync(Guid tenantId, string? newTier, string? billingInterval, CancellationToken cancellationToken = default);

    /// <summary>
    /// Synchronizes tenant subscription fields from the current Stripe subscription state.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The updated tenant entity.</returns>
    Task<Result<Tenant>> SyncSubscriptionToTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Extends the trial end date of a tenant's trialing subscription. Intended for global
    /// administrators. Pushes the Stripe <c>trial_end</c> forward and updates the tenant's
    /// trial end date. The new end must be in the future and beyond the current trial end.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="newTrialEnd">The new trial end timestamp (UTC).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated subscription details.</returns>
    Task<Result<SubscriptionDto>> ExtendTrialAsync(Guid tenantId, DateTimeOffset newTrialEnd, CancellationToken cancellationToken = default);
}
