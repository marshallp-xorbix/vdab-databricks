using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Validates and resolves Stripe promotion codes for subscription signup.
/// </summary>
public interface IStripePromotionCodeService
{
    /// <summary>
    /// Validates a promotion code for the given tier and billing interval without redeeming it.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="code">Customer-facing promotion code.</param>
    /// <param name="tier">Target subscription tier.</param>
    /// <param name="billingInterval">Billing interval (Monthly only for v1).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Validation preview when the code is eligible.</returns>
    Task<Result<PromoCodeValidationDto>> ValidateAsync(
        Guid tenantId,
        string code,
        string tier,
        string billingInterval,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates and resolves a promotion code for attachment to a new Stripe subscription.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="code">Customer-facing promotion code.</param>
    /// <param name="tier">Target subscription tier.</param>
    /// <param name="billingInterval">Billing interval (Monthly only for v1).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Resolved Stripe promotion code details.</returns>
    Task<Result<PromoCodeResolution>> ResolveForSubscriptionAsync(
        Guid tenantId,
        string code,
        string tier,
        string billingInterval,
        CancellationToken cancellationToken = default);
}
