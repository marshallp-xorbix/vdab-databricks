using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Validates and redeems application-managed beta codes that grant Stripe no-card free trials.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="BetaCodeService"/> class.
/// </remarks>
public class BetaCodeService(
    ILogger<BetaCodeService> _logger,
    IBetaCodeRepository _betaCodeRepository,
    ITenantRepository _tenantRepository,
    IStripeSubscriptionService _stripeSubscriptionService) : IBetaCodeService
{
    /// <inheritdoc/>
    public async Task<Result<BetaCodeValidationDto>> ValidateAsync(Guid tenantId, string code, CancellationToken cancellationToken = default)
    {
        Result<BetaCode> codeResult = await ResolveRedeemableCodeAsync(tenantId, code, cancellationToken);
        if (codeResult.IsFailed)
        {
            return Result.Fail<BetaCodeValidationDto>(codeResult.Errors);
        }

        BetaCode betaCode = codeResult.Value;
        DateTimeOffset trialEnd = ResolveTrialEnd(betaCode);

        BetaCodeValidationDto validation = new BetaCodeValidationDto
        {
            IsValid = true,
            Tier = betaCode.Tier,
            TrialPeriodDays = betaCode.TrialPeriodDays,
            TrialEndDate = trialEnd.UtcDateTime,
            Message = $"Beta access granted: free {betaCode.Tier} trial until {trialEnd:MMMM d, yyyy} — no payment method required."
        };

        return Result.Ok(validation);
    }

    /// <inheritdoc/>
    public async Task<Result<BetaCodeValidationDto>> ValidatePreviewAsync(string code, string? expectedTier = null, CancellationToken cancellationToken = default)
    {
        try
        {
        Result<BetaCode> codeResult = await ResolveCodeAsync(code, expectedTier, cancellationToken);
        if (codeResult.IsFailed)
        {
            return Result.Fail<BetaCodeValidationDto>(codeResult.Errors);
        }

        BetaCode betaCode = codeResult.Value;
        DateTimeOffset trialEnd = ResolveTrialEnd(betaCode);

        BetaCodeValidationDto validation = new BetaCodeValidationDto
        {
            IsValid = true,
            Tier = betaCode.Tier,
            TrialPeriodDays = betaCode.TrialPeriodDays,
            TrialEndDate = trialEnd.UtcDateTime,
            Message = $"Beta access granted: free {betaCode.Tier} trial until {trialEnd:MMMM d, yyyy} — no payment method required."
        };

        return Result.Ok(validation);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate beta code preview.");
            return Result.Fail<BetaCodeValidationDto>(new ExceptionalError("An unexpected error occurred while validating the beta code. Please try again later.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> RedeemAndSubscribeAsync(Guid tenantId, Guid userId, string code, CancellationToken cancellationToken = default)
    {
        try
        {
        Result<BetaCode> codeResult = await ResolveRedeemableCodeAsync(tenantId, code, cancellationToken);
        if (codeResult.IsFailed)
        {
            return Result.Fail<SubscriptionDto>(codeResult.Errors);
        }

        BetaCode betaCode = codeResult.Value;

        // Reserve a redemption slot atomically before calling Stripe so concurrent redemptions
        // cannot exceed the code's limit. The redemption record itself is written only after the
        // subscription is created (below); a failure or crash before that point leaves no record,
        // so the tenant is never permanently blocked from retrying.
        bool reserved = await _betaCodeRepository.TryIncrementRedemptionAsync(betaCode.BetaCodeId, cancellationToken);
        if (!reserved)
        {
            return Result.Fail<SubscriptionDto>(new ConflictError("Beta code is no longer redeemable."));
        }

        _logger.LogInformation(
            "Beta code {BetaCodeId} reserved by user {UserId} for tenant {TenantId}; creating no-card trial subscription",
            betaCode.BetaCodeId, userId, tenantId);

        BetaCodeRedemptionContext redemptionContext = new BetaCodeRedemptionContext
        {
            BetaCodeId = betaCode.BetaCodeId,
            Code = betaCode.Code,
            Tier = betaCode.Tier,
            BillingInterval = ParseBillingInterval(betaCode.BillingInterval),
            TrialPeriodDays = betaCode.TrialPeriodDays,
            TrialEndDate = betaCode.TrialEndDate
        };

        Result<SubscriptionDto> subscriptionResult =
            await _stripeSubscriptionService.CreateBetaTrialSubscriptionAsync(tenantId, redemptionContext, cancellationToken);

        if (subscriptionResult.IsFailed)
        {
            await TryReleaseReservationAsync(betaCode.BetaCodeId, tenantId);
            return Result.Fail<SubscriptionDto>(subscriptionResult.Errors);
        }

        // Subscription created successfully: record the redemption last so it only persists once
        // the tenant actually has a subscription.
        BetaCodeRedemption redemption = new BetaCodeRedemption
        {
            BetaCodeId = betaCode.BetaCodeId,
            TenantId = tenantId,
            UserId = userId,
            RedeemedOn = DateTimeOffset.UtcNow,
            CreatedBy = userId
        };

        await TryRecordRedemptionAsync(redemption, tenantId, cancellationToken);

        return subscriptionResult;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to redeem beta code and create subscription for tenant {TenantId}.", tenantId);
            return Result.Fail<SubscriptionDto>(new ExceptionalError("An unexpected error occurred while redeeming the beta code. Please try again later.", ex));
        }
    }

    /// <summary>
    /// Loads the beta code and applies all redemption eligibility rules for the tenant.
    /// Shared by validation (preview) and redemption.
    /// </summary>
    private async Task<Result<BetaCode>> ResolveRedeemableCodeAsync(Guid tenantId, string code, CancellationToken cancellationToken)
    {
        Result<BetaCode> codeResult = await ResolveCodeAsync(code, expectedTier: null, cancellationToken);
        if (codeResult.IsFailed)
        {
            return codeResult;
        }

        return await ValidateTenantEligibilityAsync(tenantId, codeResult.Value, cancellationToken);
    }

    /// <summary>
    /// Loads a beta code and applies code-level redemption rules shared by preview and tenant validation.
    /// </summary>
    private async Task<Result<BetaCode>> ResolveCodeAsync(string code, string? expectedTier, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Fail<BetaCode>(new BadRequestError("Beta code is required."));
        }

        string normalizedCode = code.Trim().ToUpperInvariant();
        BetaCode? betaCode = await _betaCodeRepository.GetByCodeAsync(normalizedCode, cancellationToken);
        if (betaCode == null)
        {
            return Result.Fail<BetaCode>(new NotFoundError("Beta code is invalid."));
        }

        if (!betaCode.IsActive)
        {
            return Result.Fail<BetaCode>(new BadRequestError("Beta code is no longer active."));
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;
        if (betaCode.ExpiresOn.HasValue && betaCode.ExpiresOn.Value <= now)
        {
            return Result.Fail<BetaCode>(new GoneError("Beta code has expired."));
        }

        if (betaCode.TrialEndDate.HasValue && betaCode.TrialEndDate.Value <= now)
        {
            return Result.Fail<BetaCode>(new GoneError("The beta period for this code has ended."));
        }

        if (betaCode.MaxRedemptions.HasValue && betaCode.RedemptionCount >= betaCode.MaxRedemptions.Value)
        {
            return Result.Fail<BetaCode>(new ConflictError("Beta code has reached its redemption limit."));
        }

        if (string.Equals(betaCode.Tier, SubscriptionTierNames.Enterprise, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Fail<BetaCode>(new BadRequestError("Beta codes apply to Individual or Team plans only."));
        }

        if (!betaCode.TrialEndDate.HasValue && betaCode.TrialPeriodDays is not > 0)
        {
            return Result.Fail<BetaCode>(new BadRequestError("Beta code does not define a trial length."));
        }

        if (!string.IsNullOrWhiteSpace(expectedTier)
            && !string.Equals(betaCode.Tier, expectedTier.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return Result.Fail<BetaCode>(new BadRequestError(
                $"Beta code applies to the {betaCode.Tier} plan only."));
        }

        return Result.Ok(betaCode);
    }

    /// <summary>
    /// Ensures the tenant is eligible for a first subscription: active, no prior beta
    /// redemption, and no existing usable Stripe subscription.
    /// </summary>
    private async Task<Result<BetaCode>> ValidateTenantEligibilityAsync(Guid tenantId, BetaCode betaCode, CancellationToken cancellationToken)
    {
        Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
        if (tenant == null || !tenant.IsActive)
        {
            return Result.Fail<BetaCode>(new NotFoundError("Tenant not found."));
        }

        bool hasRedeemed = await _betaCodeRepository.HasTenantRedeemedAsync(tenantId, cancellationToken);
        if (hasRedeemed)
        {
            return Result.Fail<BetaCode>(new ConflictError("A beta code has already been redeemed for this account."));
        }

        if (!string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId)
            && !string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.None, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.Canceled, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Fail<BetaCode>(new ConflictError("Tenant already has an active subscription."));
        }

        return Result.Ok(betaCode);
    }

    private async Task TryReleaseReservationAsync(Guid betaCodeId, Guid tenantId)
    {
        try
        {
            await _betaCodeRepository.ReleaseRedemptionAsync(betaCodeId);
            _logger.LogInformation(
                "Released beta code reservation {BetaCodeId} for tenant {TenantId} after subscription creation failure",
                betaCodeId, tenantId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to release beta code reservation {BetaCodeId} for tenant {TenantId}; redemption count may be over-counted",
                betaCodeId, tenantId);
        }
    }

    /// <summary>
    /// Persists the redemption record with a short bounded retry to absorb transient database
    /// failures. The subscription is the source of truth and is already created by this point, so
    /// a final failure is logged (not thrown): re-redemption stays blocked by the
    /// active-subscription check, and the redemption is durably traced in subscription history.
    /// </summary>
    private async Task TryRecordRedemptionAsync(BetaCodeRedemption redemption, Guid tenantId, CancellationToken cancellationToken)
    {
        const int maxAttempts = 3;
        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                await _betaCodeRepository.AddRedemptionAsync(redemption, cancellationToken);
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                bool willRetry = attempt < maxAttempts && !cancellationToken.IsCancellationRequested;
                if (!willRetry)
                {
                    _logger.LogError(ex,
                        "Beta trial subscription was created for tenant {TenantId} but recording the redemption failed after {Attempts} attempt(s); " +
                        "re-redemption is still blocked by the active-subscription check.",
                        tenantId, attempt);
                    return;
                }

                _logger.LogWarning(ex,
                    "Recording beta redemption for tenant {TenantId} failed on attempt {Attempt}/{MaxAttempts}; retrying.",
                    tenantId, attempt, maxAttempts);

                try
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(200 * attempt), cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }

    private static DateTimeOffset ResolveTrialEnd(BetaCode betaCode)
    {
        if (betaCode.TrialEndDate.HasValue)
        {
            return betaCode.TrialEndDate.Value;
        }

        int trialDays = betaCode.TrialPeriodDays ?? 0;
        return DateTimeOffset.UtcNow.AddDays(trialDays);
    }

    private static BillingInterval ParseBillingInterval(string billingInterval)
    {
        return BillingIntervalParser.TryParse(billingInterval, out BillingInterval parsedInterval)
            ? parsedInterval
            : BillingInterval.Monthly;
    }
}
