using FluentResults;
using Microsoft.Extensions.Logging;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Validates and resolves Stripe promotion codes for subscription signup.
/// </summary>
public class StripePromotionCodeService(
    ILogger<StripePromotionCodeService> _logger,
    ITenantRepository _tenantRepository,
    ISubscriptionTierService _subscriptionTierService,
    IStripeClient _stripeClient) : IStripePromotionCodeService
{
    /// <inheritdoc/>
    public async Task<Result<PromoCodeValidationDto>> ValidateAsync(
        Guid tenantId,
        string code,
        string tier,
        string billingInterval,
        CancellationToken cancellationToken = default)
    {
        Result<PromoCodeResolution> resolutionResult = await ResolveInternalAsync(
            tenantId,
            code,
            tier,
            billingInterval,
            cancellationToken);

        if (resolutionResult.IsFailed)
        {
            return Result.Fail<PromoCodeValidationDto>(resolutionResult.Errors);
        }

        PromoCodeResolution resolution = resolutionResult.Value;
        PromoCodeValidationDto validation = new PromoCodeValidationDto
        {
            IsValid = true,
            Message = BuildValidationMessage(resolution.FreeMonths, NormalizeTierName(tier)),
            FreeMonths = resolution.FreeMonths,
            DiscountEndsAt = resolution.DiscountEndsAt
        };

        return Result.Ok(validation);
    }

    /// <inheritdoc/>
    public Task<Result<PromoCodeResolution>> ResolveForSubscriptionAsync(
        Guid tenantId,
        string code,
        string tier,
        string billingInterval,
        CancellationToken cancellationToken = default)
    {
        return ResolveInternalAsync(tenantId, code, tier, billingInterval, cancellationToken);
    }

    private async Task<Result<PromoCodeResolution>> ResolveInternalAsync(
        Guid tenantId,
        string code,
        string tier,
        string billingInterval,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Fail<PromoCodeResolution>(new BadRequestError("Promo code is required."));
        }

        Result<(string NormalizedTier, BillingInterval Interval, string PriceId, string ProductId)> contextResult =
            await BuildPromoContextAsync(tenantId, tier, billingInterval, cancellationToken);

        if (contextResult.IsFailed)
        {
            return Result.Fail<PromoCodeResolution>(contextResult.Errors);
        }

        (string normalizedTier, BillingInterval interval, string priceId, string productId) = contextResult.Value;

        Result<PromotionCode> promotionCodeResult = await LookupPromotionCodeAsync(code.Trim(), cancellationToken);
        if (promotionCodeResult.IsFailed)
        {
            return Result.Fail<PromoCodeResolution>(promotionCodeResult.Errors);
        }

        PromotionCode promotionCode = promotionCodeResult.Value;
        Coupon? coupon = promotionCode.Promotion?.Coupon;
        if (coupon == null)
        {
            return Result.Fail<PromoCodeResolution>(new BadRequestError("Promotion code is not linked to a valid coupon."));
        }

        Result couponValidationResult = ValidateCouponForTier(coupon, productId, normalizedTier);
        if (couponValidationResult.IsFailed)
        {
            return Result.Fail<PromoCodeResolution>(couponValidationResult.Errors);
        }

        int freeMonths = Convert.ToInt32(coupon.DurationInMonths ?? 0);
        DateTime? discountEndsAt = EstimateDiscountEndDate(freeMonths);

        _logger.LogInformation(
            "Promotion code {Code} validated for tenant {TenantId}, tier={Tier}, interval={Interval}, priceId={PriceId}",
            promotionCode.Code,
            tenantId,
            normalizedTier,
            interval,
            priceId);

        PromoCodeResolution resolution = new PromoCodeResolution
        {
            PromotionCodeId = promotionCode.Id,
            Code = promotionCode.Code ?? code.Trim(),
            CouponId = coupon.Id,
            FreeMonths = freeMonths,
            DiscountEndsAt = discountEndsAt
        };

        return Result.Ok(resolution);
    }

    private async Task<Result<(string NormalizedTier, BillingInterval Interval, string PriceId, string ProductId)>> BuildPromoContextAsync(
        Guid tenantId,
        string tier,
        string billingInterval,
        CancellationToken cancellationToken)
    {
        Result tenantGuardResult = await ValidateTenantEligibleForPromoAsync(tenantId, cancellationToken);
        if (tenantGuardResult.IsFailed)
        {
            return Result.Fail<(string NormalizedTier, BillingInterval Interval, string PriceId, string ProductId)>(tenantGuardResult.Errors);
        }

        string normalizedTier = NormalizeTierName(tier);
        if (string.Equals(normalizedTier, SubscriptionTierNames.Trial, StringComparison.Ordinal)
            || string.Equals(normalizedTier, SubscriptionTierNames.Enterprise, StringComparison.Ordinal))
        {
            return Result.Fail<(string NormalizedTier, BillingInterval Interval, string PriceId, string ProductId)>(
                new BadRequestError("Promo codes apply to Individual or Team plans only."));
        }

        if (!BillingIntervalParser.TryParse(billingInterval, out BillingInterval parsedInterval))
        {
            return Result.Fail<(string NormalizedTier, BillingInterval Interval, string PriceId, string ProductId)>(
                new BadRequestError($"Invalid billing interval '{billingInterval}'."));
        }

        if (parsedInterval != BillingInterval.Monthly)
        {
            return Result.Fail<(string NormalizedTier, BillingInterval Interval, string PriceId, string ProductId)>(
                new BadRequestError("Promo codes apply to monthly billing only."));
        }

        Result<string> priceIdResult = _subscriptionTierService.GetTierPriceId(normalizedTier, parsedInterval);
        if (priceIdResult.IsFailed)
        {
            return Result.Fail<(string NormalizedTier, BillingInterval Interval, string PriceId, string ProductId)>(
                new BadRequestError("Unable to resolve a price for the selected plan."));
        }

        string priceId = priceIdResult.Value;
        Result<string> productIdResult = await GetProductIdForPriceAsync(priceId, cancellationToken);
        if (productIdResult.IsFailed)
        {
            return Result.Fail<(string NormalizedTier, BillingInterval Interval, string PriceId, string ProductId)>(
                productIdResult.Errors);
        }

        return Result.Ok((normalizedTier, parsedInterval, priceId, productIdResult.Value));
    }

    private async Task<Result> ValidateTenantEligibleForPromoAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId);
        if (tenant == null || !tenant.IsActive)
        {
            return Result.Fail(new NotFoundError("Tenant not found."));
        }

        if (TenantSubscriptionGuard.HasActiveSubscription(tenant))
        {
            return Result.Fail(new ConflictError("Tenant already has an active subscription."));
        }

        return Result.Ok();
    }

    private async Task<Result<PromotionCode>> LookupPromotionCodeAsync(string code, CancellationToken cancellationToken)
    {
        PromotionCodeService promotionCodeService = new(_stripeClient);
        PromotionCodeListOptions listOptions = new()
        {
            Code = code,
            Active = true,
            Limit = 1,
            Expand = ["data.promotion.coupon", "data.promotion.coupon.applies_to"]
        };

        StripeList<PromotionCode> promotionCodes = await promotionCodeService.ListAsync(
            listOptions,
            requestOptions: null,
            cancellationToken: cancellationToken);

        PromotionCode? promotionCode = promotionCodes.Data.FirstOrDefault();
        if (promotionCode == null)
        {
            return Result.Fail<PromotionCode>(new BadRequestError("Promo code is invalid or expired."));
        }

        if (promotionCode.ExpiresAt.HasValue && promotionCode.ExpiresAt.Value <= DateTime.UtcNow)
        {
            return Result.Fail<PromotionCode>(new BadRequestError("Promo code is invalid or expired."));
        }

        if (promotionCode.MaxRedemptions.HasValue
            && promotionCode.TimesRedeemed >= promotionCode.MaxRedemptions.Value)
        {
            return Result.Fail<PromotionCode>(new BadRequestError("Promo code has reached its redemption limit."));
        }

        return Result.Ok(promotionCode);
    }

    private static Result ValidateCouponForTier(Coupon coupon, string productId, string normalizedTier)
    {
        if (!string.Equals(coupon.Duration, PromoCouponRules.RepeatingDuration, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Fail(new BadRequestError("Promo code must grant a repeating free period."));
        }

        if (coupon.PercentOff != PromoCouponRules.FullDiscountPercentOff)
        {
            return Result.Fail(new BadRequestError("Promo code must provide 100% off during the promotional period."));
        }

        if (!coupon.DurationInMonths.HasValue || coupon.DurationInMonths.Value <= 0)
        {
            return Result.Fail(new BadRequestError("Promo code free period is not configured."));
        }

        List<string> allowedProducts = coupon.AppliesTo?.Products?.ToList() ?? [];
        if (allowedProducts.Count > 0 && !allowedProducts.Contains(productId, StringComparer.Ordinal))
        {
            return Result.Fail(new BadRequestError(
                $"Promo code is not valid for the {normalizedTier} plan."));
        }

        return Result.Ok();
    }

    private async Task<Result<string>> GetProductIdForPriceAsync(string priceId, CancellationToken cancellationToken)
    {
        try
        {
            PriceService priceService = new(_stripeClient);
            Price price = await priceService.GetAsync(priceId, cancellationToken: cancellationToken);

            if (string.IsNullOrWhiteSpace(price.ProductId))
            {
                return Result.Fail<string>(new BadRequestError("Unable to resolve the product for the selected plan."));
            }

            return Result.Ok(price.ProductId);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Failed to retrieve Stripe price {PriceId} for promo validation", priceId);
            return Result.Fail<string>(new BadRequestError("Unable to validate promo code against the selected plan."));
        }
    }

    private static string NormalizeTierName(string tier) => SubscriptionTierNormalizer.Normalize(tier);

    private static DateTime? EstimateDiscountEndDate(int freeMonths)
    {
        if (freeMonths <= 0)
        {
            return null;
        }

        return DateTime.UtcNow.AddMonths(freeMonths);
    }

    private static string BuildValidationMessage(int freeMonths, string tier)
    {
        string tierLabel = string.IsNullOrWhiteSpace(tier) ? "selected" : tier.Trim();
        return $"{freeMonths} month{(freeMonths == 1 ? string.Empty : "s")} free on {tierLabel} — then standard monthly pricing applies.";
    }
}
