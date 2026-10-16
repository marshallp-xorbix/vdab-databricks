using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Validates and redeems application-managed beta codes that grant Stripe no-card free trials.
/// </summary>
public interface IBetaCodeService
{
    /// <summary>
    /// Validates a beta code for the tenant without redeeming it. Returns a preview of the
    /// granted tier and trial length for display before the user starts the trial.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="code">Customer-facing beta code string (case-insensitive).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Validation preview when the code is redeemable.</returns>
    Task<Result<BetaCodeValidationDto>> ValidateAsync(Guid tenantId, string code, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates a beta code before account creation. Applies code-level rules only and skips
    /// tenant eligibility checks because no tenant exists yet.
    /// </summary>
    /// <param name="code">Customer-facing beta code string (case-insensitive).</param>
    /// <param name="expectedTier">Optional tier the user selected; when provided, the code must grant that tier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Validation preview when the code is redeemable.</returns>
    Task<Result<BetaCodeValidationDto>> ValidatePreviewAsync(string code, string? expectedTier = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Redeems a beta code for the tenant (atomically consuming a redemption) and creates the
    /// Stripe no-card trial subscription. The redemption is reverted if subscription creation fails.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="userId">User performing the redemption.</param>
    /// <param name="code">Customer-facing beta code string (case-insensitive).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Created subscription details (no payment confirmation secret).</returns>
    Task<Result<SubscriptionDto>> RedeemAndSubscribeAsync(Guid tenantId, Guid userId, string code, CancellationToken cancellationToken = default);
}
