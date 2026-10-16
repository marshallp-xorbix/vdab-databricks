using FluentResults;
using Microsoft.Extensions.Logging;
using Stripe;
using System.Text.Json;
using System.Transactions;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for Stripe subscription lifecycle and tenant synchronization.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="StripeSubscriptionService"/> class.
/// </remarks>
public class StripeSubscriptionService(
    ILogger<StripeSubscriptionService> _logger,
    ITenantRepository _tenantRepository,
    ISubscriptionTierService _subscriptionTierService,
    ISeatManagementService _seatManagementService,
    IStripeCustomerService _stripeCustomerService,
    ISubscriptionSeatRepository _subscriptionSeatRepository,
    IStripePromotionCodeService _stripePromotionCodeService,
    ISubscriptionHistoryRepository _subscriptionHistoryRepository,
    IInternalDevTenantService _internalDevTenantService,
    IStripeClient _stripeClient) : IStripeSubscriptionService
{
    private const string ActiveSeatStatus = "Active";
    private const string PendingCancellationSeatStatus = "PendingCancellation";
    private const string CanceledSeatStatus = "Canceled";
    private const string ChargeAutomaticallyCollectionMethod = "charge_automatically";
    private const string DefaultIncompletePaymentBehavior = "default_incomplete";
    private const string MissingPaymentMethodCancel = "cancel";
    private const string MissingPaymentMethodPause = "pause";
    private static readonly TimeSpan CompensationTimeout = TimeSpan.FromSeconds(20);

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> CreateSubscriptionAsync(
        Guid tenantId,
        string tier,
        string billingInterval,
        string? promoCode = null,
        bool startTrial = false,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("CreateSubscriptionAsync started for tenant {TenantId}, tier={Tier}, interval={BillingInterval}, startTrial={StartTrial}", tenantId, tier, billingInterval, startTrial);

        string? createdSubscriptionId = null;
        bool localChangesCommitted = false;

        if (!BillingIntervalParser.TryParse(billingInterval, out BillingInterval parsedInterval))
        {
            _logger.LogWarning("Invalid billing interval '{BillingInterval}' for tenant {TenantId}", billingInterval, tenantId);
            return Result.Fail<SubscriptionDto>($"Invalid billing interval '{billingInterval}'.");
        }

        try
        {
            Result<Tenant> tenantResult = await GetActiveTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                _logger.LogWarning("GetActiveTenantAsync failed for tenant {TenantId}: {Errors}", tenantId, string.Join("; ", tenantResult.Errors.Select(e => e.Message)));
                return Result.Fail<SubscriptionDto>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;
            _logger.LogDebug("Tenant {TenantId} loaded — CurrentStatus={Status}, CurrentTier={Tier}",
                tenantId, tenant.SubscriptionStatus, tenant.SubscriptionTier);

            Result<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, string DefaultPaymentMethodId, Guid CreatorUserId)> createContextResult =
                await BuildCreateSubscriptionContextAsync(tenant, tier, parsedInterval, cancellationToken);

            if (createContextResult.IsFailed)
            {
                _logger.LogWarning("BuildCreateSubscriptionContextAsync failed for tenant {TenantId}: {Errors}", tenantId, string.Join("; ", createContextResult.Errors.Select(e => e.Message)));
                return Result.Fail<SubscriptionDto>(createContextResult.Errors);
            }

            (string normalizedTier, SubscriptionTierLimits tierLimits, string priceId, string customerId, string defaultPaymentMethodId, Guid creatorUserId) = createContextResult.Value;
            _logger.LogDebug("Subscription context built — Tier={Tier}, PriceId={PriceId}, CustomerId={CustomerId}, Quantity={Quantity}, CreatorUserId={CreatorUserId}",
                normalizedTier, priceId, customerId, tierLimits.MinimumSeats, creatorUserId);

            int quantity = ResolveInitialQuantity(normalizedTier, tierLimits.MinimumSeats);

            PromoCodeResolution? promoResolution = null;
            if (!string.IsNullOrWhiteSpace(promoCode))
            {
                Result<PromoCodeResolution> promoResult = await _stripePromotionCodeService.ResolveForSubscriptionAsync(
                    tenantId,
                    promoCode,
                    tier,
                    billingInterval,
                    cancellationToken);

                if (promoResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Promo code resolution failed for tenant {TenantId}: {Errors}",
                        tenantId,
                        string.Join("; ", promoResult.Errors.Select(error => error.Message)));
                    return Result.Fail<SubscriptionDto>(promoResult.Errors);
                }

                promoResolution = promoResult.Value;
            }

            SubscriptionCreateOptions createOptions = new()
            {
                Customer = customerId,
                DefaultPaymentMethod = defaultPaymentMethodId,
                CollectionMethod = ChargeAutomaticallyCollectionMethod,
                PaymentBehavior = DefaultIncompletePaymentBehavior,
                Items =
                [
                    new() {
                        Price = priceId,
                        Quantity = quantity
                    }
                ],
                Expand =
                [
                    "latest_invoice.confirmation_secret",
                    "discounts",
                    "discounts.promotion_code",
                    "discounts.source.coupon"
                ]
            };

            if (promoResolution != null)
            {
                createOptions.Discounts =
                [
                    new SubscriptionDiscountOptions
                    {
                        PromotionCode = promoResolution.PromotionCodeId
                    }
                ];
            }

            bool trialRequested = startTrial && tierLimits.Trial is { Enabled: true, PeriodDays: > 0 };
            if (trialRequested)
            {
                createOptions.TrialPeriodDays = tierLimits.Trial!.PeriodDays;
                createOptions.TrialSettings = new SubscriptionTrialSettingsOptions
                {
                    EndBehavior = new SubscriptionTrialSettingsEndBehaviorOptions
                    {
                        MissingPaymentMethod = MissingPaymentMethodCancel
                    }
                };
            }

            _logger.LogInformation("Calling Stripe to create subscription for customer {CustomerId}, priceId={PriceId}, quantity={Quantity}, trial={Trial}", customerId, priceId, quantity, trialRequested);
            SubscriptionService subscriptionService = new(_stripeClient);
            Stripe.Subscription createdSubscription = await subscriptionService.CreateAsync(
                createOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);
            createdSubscriptionId = createdSubscription.Id;

            Stripe.SubscriptionItem? createdItem = createdSubscription.Items?.Data?.FirstOrDefault();
            _logger.LogDebug("Stripe subscription created — SubscriptionId={SubscriptionId}, Status={Status}, ItemId={ItemId}",
                createdSubscription.Id, createdSubscription.Status, createdItem?.Id);

            if (createdItem == null)
            {
                _logger.LogError("Stripe subscription {SubscriptionId} was created but returned no subscription items — cancelling", createdSubscription.Id);
                await TryCancelSubscriptionWithTimeoutAsync(createdSubscription.Id);
                return Result.Fail<SubscriptionDto>(new NotFoundError("Stripe subscription item was not returned by Stripe."));
            }

            using (TransactionScope localTransaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled))
            {
                Result<int> initializeSeatsResult = await _seatManagementService.InitializeSeatsForSubscriptionAsync(tenantId, normalizedTier, creatorUserId, cancellationToken);
                if (initializeSeatsResult.IsFailed)
                {
                    _logger.LogError("InitializeSeatsForSubscriptionAsync failed for tenant {TenantId}: {Errors} — cancelling Stripe subscription {SubscriptionId}",
                        tenantId, string.Join("; ", initializeSeatsResult.Errors.Select(e => e.Message)), createdSubscription.Id);
                    await TryCancelSubscriptionWithTimeoutAsync(createdSubscription.Id);
                    return Result.Fail<SubscriptionDto>(initializeSeatsResult.Errors);
                }
                _logger.LogDebug("Seats initialized successfully for tenant {TenantId}", tenantId);

                tenant.StripeSubscriptionId = createdSubscription.Id;
                tenant.BillingCycle = parsedInterval.ToString();
                ApplyStripeStateToTenant(tenant, createdSubscription, createdItem, normalizedTier);

                tenant.MaxUsers = initializeSeatsResult.Value;
                ApplyEffectiveLimitsToTenant(tenant, normalizedTier, tenant.SubscriptionStatus, tenant.MaxUsers);

                await _tenantRepository.UpdateAsync(tenant, cancellationToken);

                localTransaction.Complete();
                localChangesCommitted = true;
            }

            _logger.LogInformation("CreateSubscriptionAsync completed for tenant {TenantId}, subscriptionId={SubscriptionId}, maxUsers={MaxUsers}",
                tenantId, createdSubscription.Id, tenant.MaxUsers);

            if (promoResolution != null)
            {
                try
                {
                    await RecordPromoAppliedHistoryAsync(
                        tenantId,
                        normalizedTier,
                        parsedInterval,
                        promoResolution,
                        cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Failed to record promo applied history for tenant {TenantId}; subscription {SubscriptionId} was created successfully",
                        tenantId,
                        createdSubscription.Id);
                }
            }

            Result<SubscriptionDto> dtoResult = await BuildSubscriptionDtoAsync(tenant, createdSubscription, createdItem, cancellationToken);

            if (dtoResult.IsSuccess)
            {
                string? clientSecret = createdSubscription.LatestInvoice?.ConfirmationSecret?.ClientSecret;
                if (!string.IsNullOrWhiteSpace(clientSecret))
                {
                    dtoResult.Value.ClientSecret = clientSecret;
                    _logger.LogDebug("ConfirmationSecret client secret attached for subscription {SubscriptionId}", createdSubscription.Id);
                }
            }

            return dtoResult;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            if (!localChangesCommitted && !string.IsNullOrWhiteSpace(createdSubscriptionId))
            {
                await TryCancelSubscriptionWithTimeoutAsync(createdSubscriptionId);
            }

            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe subscription creation failed for tenant {TenantId} — StripeError={StripeErrorType}, Code={Code}, Message={StripeMessage}",
                tenantId, ex.StripeError?.Type, ex.StripeError?.Code, ex.StripeError?.Message);
            return Result.Fail<SubscriptionDto>(BuildStripeError(ex, "Failed to create Stripe subscription."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error creating subscription for tenant {TenantId}, localCommitted={LocalCommitted}, stripeSubId={SubscriptionId}",
                tenantId, localChangesCommitted, createdSubscriptionId);
            if (!localChangesCommitted && !string.IsNullOrWhiteSpace(createdSubscriptionId))
            {
                await TryCancelSubscriptionWithTimeoutAsync(createdSubscriptionId);
            }

            return Result.Fail<SubscriptionDto>("Failed to create subscription.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> CreateBetaTrialSubscriptionAsync(
        Guid tenantId,
        BetaCodeRedemptionContext redemption,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "CreateBetaTrialSubscriptionAsync started for tenant {TenantId}, betaCodeId={BetaCodeId}, tier={Tier}",
            tenantId, redemption.BetaCodeId, redemption.Tier);

        Result<DateTimeOffset> trialEndResult = ResolveBetaTrialEnd(redemption);
        if (trialEndResult.IsFailed)
        {
            return Result.Fail<SubscriptionDto>(trialEndResult.Errors);
        }

        DateTimeOffset trialEnd = trialEndResult.Value;
        string? createdSubscriptionId = null;
        bool localChangesCommitted = false;

        try
        {
            Result<Tenant> tenantResult = await GetActiveTenantForBetaTrialAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;
            Result<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, Guid CreatorUserId)> contextResult =
                await BuildSubscriptionContextCoreAsync(tenant, redemption.Tier, redemption.BillingInterval, cancellationToken);

            if (contextResult.IsFailed)
            {
                _logger.LogWarning("BuildSubscriptionContextCoreAsync failed for tenant {TenantId}: {Errors}",
                    tenantId, string.Join("; ", contextResult.Errors.Select(e => e.Message)));
                return Result.Fail<SubscriptionDto>(contextResult.Errors);
            }

            (string normalizedTier, SubscriptionTierLimits tierLimits, string priceId, string customerId, Guid creatorUserId) = contextResult.Value;
            int quantity = ResolveInitialQuantity(normalizedTier, tierLimits.MinimumSeats);

            // No DefaultPaymentMethod: Stripe's no-card free trial. The subscription starts
            // trialing without payment details and pauses at trial end if none were added
            // (the Subscriptions API has no payment_method_collection parameter; that is
            // Checkout-only — omitting the payment method is the equivalent here).
            SubscriptionCreateOptions createOptions = new()
            {
                Customer = customerId,
                CollectionMethod = ChargeAutomaticallyCollectionMethod,
                PaymentBehavior = DefaultIncompletePaymentBehavior,
                TrialEnd = trialEnd.UtcDateTime,
                TrialSettings = new SubscriptionTrialSettingsOptions
                {
                    EndBehavior = new SubscriptionTrialSettingsEndBehaviorOptions
                    {
                        MissingPaymentMethod = MissingPaymentMethodPause
                    }
                },
                Items =
                [
                    new() {
                        Price = priceId,
                        Quantity = quantity
                    }
                ]
            };

            _logger.LogInformation(
                "Calling Stripe to create beta trial subscription for customer {CustomerId}, priceId={PriceId}, quantity={Quantity}, trialEnd={TrialEnd}",
                customerId, priceId, quantity, trialEnd);

            SubscriptionService subscriptionService = new(_stripeClient);
            Stripe.Subscription createdSubscription = await subscriptionService.CreateAsync(
                createOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);
            createdSubscriptionId = createdSubscription.Id;

            Stripe.SubscriptionItem? createdItem = createdSubscription.Items?.Data?.FirstOrDefault();
            if (createdItem == null)
            {
                _logger.LogError("Stripe beta trial subscription {SubscriptionId} was created but returned no subscription items — cancelling", createdSubscription.Id);
                await TryCancelSubscriptionWithTimeoutAsync(createdSubscription.Id);
                return Result.Fail<SubscriptionDto>(new NotFoundError("Stripe subscription item was not returned by Stripe."));
            }

            using (TransactionScope localTransaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled))
            {
                Result<int> initializeSeatsResult = await _seatManagementService.InitializeSeatsForSubscriptionAsync(tenantId, normalizedTier, creatorUserId, cancellationToken);
                if (initializeSeatsResult.IsFailed)
                {
                    _logger.LogError("InitializeSeatsForSubscriptionAsync failed for tenant {TenantId}: {Errors} — cancelling Stripe subscription {SubscriptionId}",
                        tenantId, string.Join("; ", initializeSeatsResult.Errors.Select(e => e.Message)), createdSubscription.Id);
                    await TryCancelSubscriptionWithTimeoutAsync(createdSubscription.Id);
                    return Result.Fail<SubscriptionDto>(initializeSeatsResult.Errors);
                }

                tenant.StripeSubscriptionId = createdSubscription.Id;
                tenant.BillingCycle = redemption.BillingInterval.ToString();
                ApplyStripeStateToTenant(tenant, createdSubscription, createdItem, normalizedTier);

                tenant.MaxUsers = initializeSeatsResult.Value;
                ApplyEffectiveLimitsToTenant(tenant, normalizedTier, tenant.SubscriptionStatus, tenant.MaxUsers);

                await _tenantRepository.UpdateAsync(tenant, cancellationToken);

                localTransaction.Complete();
                localChangesCommitted = true;
            }

            _logger.LogInformation(
                "CreateBetaTrialSubscriptionAsync completed for tenant {TenantId}, subscriptionId={SubscriptionId}, status={Status}, trialEnd={TrialEnd}",
                tenantId, createdSubscription.Id, createdSubscription.Status, trialEnd);

            await RecordBetaCodeRedeemedHistoryAsync(tenantId, normalizedTier, redemption, trialEnd, cancellationToken);

            return await BuildSubscriptionDtoAsync(tenant, createdSubscription, createdItem, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            if (!localChangesCommitted && !string.IsNullOrWhiteSpace(createdSubscriptionId))
            {
                await TryCancelSubscriptionWithTimeoutAsync(createdSubscriptionId);
            }

            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe beta trial subscription creation failed for tenant {TenantId} — StripeError={StripeErrorType}, Code={Code}, Message={StripeMessage}",
                tenantId, ex.StripeError?.Type, ex.StripeError?.Code, ex.StripeError?.Message);
            return Result.Fail<SubscriptionDto>(BuildStripeError(ex, "Failed to create beta trial subscription."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error creating beta trial subscription for tenant {TenantId}, localCommitted={LocalCommitted}, stripeSubId={SubscriptionId}",
                tenantId, localChangesCommitted, createdSubscriptionId);
            if (!localChangesCommitted && !string.IsNullOrWhiteSpace(createdSubscriptionId))
            {
                await TryCancelSubscriptionWithTimeoutAsync(createdSubscriptionId);
            }

            return Result.Fail<SubscriptionDto>("Failed to create beta trial subscription.");
        }
    }

    /// <summary>
    /// Resolves the absolute trial end timestamp from the redeemed beta code. An explicit
    /// <c>TrialEndDate</c> wins over <c>TrialPeriodDays</c>; the result must be in the future.
    /// </summary>
    private static Result<DateTimeOffset> ResolveBetaTrialEnd(BetaCodeRedemptionContext redemption)
    {
        DateTimeOffset? trialEnd = redemption.TrialEndDate;
        if (!trialEnd.HasValue && redemption.TrialPeriodDays is > 0)
        {
            trialEnd = DateTimeOffset.UtcNow.AddDays(redemption.TrialPeriodDays.Value);
        }

        if (!trialEnd.HasValue)
        {
            return Result.Fail<DateTimeOffset>(new BadRequestError("Beta code does not define a trial length."));
        }

        if (trialEnd.Value <= DateTimeOffset.UtcNow)
        {
            return Result.Fail<DateTimeOffset>(new BadRequestError("Beta code trial end date must be in the future."));
        }

        return Result.Ok(trialEnd.Value);
    }

    private async Task RecordBetaCodeRedeemedHistoryAsync(
        Guid tenantId,
        string normalizedTier,
        BetaCodeRedemptionContext redemption,
        DateTimeOffset trialEnd,
        CancellationToken cancellationToken)
    {
        try
        {
            string notes = JsonSerializer.Serialize(new
            {
                betaCodeId = redemption.BetaCodeId,
                betaCode = redemption.Code,
                trialEnd = trialEnd.UtcDateTime.ToString("o")
            });

            SubscriptionHistory history = new SubscriptionHistory
            {
                TenantId = tenantId,
                EventType = "BetaCodeRedeemed",
                SubscriptionTier = normalizedTier,
                BillingCycle = redemption.BillingInterval.ToString(),
                Notes = notes,
                EventDate = DateTime.UtcNow
            };

            cancellationToken.ThrowIfCancellationRequested();
            await _subscriptionHistoryRepository.AddAsync(history);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to record beta code redeemed history for tenant {TenantId}; subscription was created successfully",
                tenantId);
        }
    }

    private async Task<Result<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, string DefaultPaymentMethodId, Guid CreatorUserId)>>
        BuildCreateSubscriptionContextAsync(Tenant tenant, string tier, BillingInterval interval, CancellationToken cancellationToken = default)
    {
        Result<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, Guid CreatorUserId)> coreResult =
            await BuildSubscriptionContextCoreAsync(tenant, tier, interval, cancellationToken);

        if (coreResult.IsFailed)
        {
            return Result.Fail<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, string DefaultPaymentMethodId, Guid CreatorUserId)>(
                coreResult.Errors);
        }

        (string normalizedTier, SubscriptionTierLimits tierLimits, string priceId, string customerId, Guid creatorUserId) = coreResult.Value;

        Result<IList<PaymentMethodDto>> paymentMethodsResult = await _stripeCustomerService.ListPaymentMethodsAsync(customerId, cancellationToken);
        if (paymentMethodsResult.IsFailed)
        {
            return Result.Fail<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, string DefaultPaymentMethodId, Guid CreatorUserId)>(
                paymentMethodsResult.Errors);
        }

        PaymentMethodDto? defaultPaymentMethod = paymentMethodsResult.Value.FirstOrDefault(method => method.IsDefault);
        if (defaultPaymentMethod == null)
        {
            return Result.Fail<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, string DefaultPaymentMethodId, Guid CreatorUserId)>(
                new BadRequestError("A default payment method is required before creating a subscription."));
        }

        return Result.Ok((
            normalizedTier,
            tierLimits,
            priceId,
            customerId,
            defaultPaymentMethod.Id,
            creatorUserId));
    }

    /// <summary>
    /// Resolves the shared subscription-creation context (tier, price, Stripe customer, seat
    /// creator) without requiring a payment method. The standard path layers the
    /// default-payment-method requirement on top; the beta no-card trial path uses this directly.
    /// </summary>
    private async Task<Result<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, Guid CreatorUserId)>>
        BuildSubscriptionContextCoreAsync(Tenant tenant, string tier, BillingInterval interval, CancellationToken cancellationToken = default)
    {
        if (TenantSubscriptionGuard.HasActiveSubscription(tenant))
        {
            return Result.Fail( new ConflictError("Tenant already has an active subscription."));
        }

        string normalizedTier = NormalizeTierName(tier);
        if (string.Equals(normalizedTier, SubscriptionTierNames.Enterprise, StringComparison.Ordinal))
        {
            return Result.Fail<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, Guid CreatorUserId)>(
                new ForbiddenError("Enterprise tier is managed outside self-service."));
        }

        Guid? creatorUserId = tenant.CreatedBy;
        if (!creatorUserId.HasValue || creatorUserId.Value == Guid.Empty)
        {
            return Result.Fail<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, Guid CreatorUserId)>(
                new BadRequestError("Tenant creator is required to initialize subscription seats."));
        }

        Result<SubscriptionTierLimits> tierLimitsResult = _subscriptionTierService.GetTierLimits(normalizedTier);
        if (tierLimitsResult.IsFailed)
        {
            return Result.Fail<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, Guid CreatorUserId)>(
                tierLimitsResult.Errors);
        }

        Result<string> priceIdResult = _subscriptionTierService.GetTierPriceId(normalizedTier, interval);
        if (priceIdResult.IsFailed)
        {
            return Result.Fail<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, Guid CreatorUserId)>(
                priceIdResult.Errors);
        }

        Result<string> customerResult = await _stripeCustomerService.GetOrCreateStripeCustomerAsync(tenant, cancellationToken: cancellationToken);
        if (customerResult.IsFailed)
        {
            return Result.Fail<(string NormalizedTier, SubscriptionTierLimits TierLimits, string PriceId, string CustomerId, Guid CreatorUserId)>(
                customerResult.Errors);
        }

        return Result.Ok((
            normalizedTier,
            tierLimitsResult.Value,
            priceIdResult.Value,
            customerResult.Value,
            creatorUserId.Value));
    }

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> GetSubscriptionAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)> contextResult =
                await GetTenantSubscriptionContextAsync(tenantId, cancellationToken);

            if (contextResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(contextResult.Errors);
            }

            (Tenant tenant, Stripe.Subscription subscription, Stripe.SubscriptionItem item) = contextResult.Value;
            return await BuildSubscriptionDtoAsync(tenant, subscription, item, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe subscription retrieval failed for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>(BuildStripeError(ex, "Failed to retrieve subscription."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving subscription for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>("Failed to retrieve subscription.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> UpdateSubscriptionAsync(Guid tenantId, string newTier, string billingInterval, CancellationToken cancellationToken = default)
    {
        string? subscriptionId = null;
        string? subscriptionItemId = null;
        string? previousPriceId = null;
        int previousQuantity = 0;
        bool stripeTierUpdated = false;
        bool localChangesCommitted = false;

        if (!BillingIntervalParser.TryParse(billingInterval, out BillingInterval parsedInterval))
        {
            return Result.Fail<SubscriptionDto>($"Invalid billing interval '{billingInterval}'.");
        }

        try
        {
            Result<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)> contextResult =
                await GetTenantSubscriptionContextAsync(tenantId, cancellationToken);

            if (contextResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(contextResult.Errors);
            }

            (Tenant tenant, Stripe.Subscription subscription, Stripe.SubscriptionItem item) = contextResult.Value;
            subscriptionId = subscription.Id;
            subscriptionItemId = item.Id;
            previousPriceId = item.Price?.Id;
            previousQuantity = Convert.ToInt32(item.Quantity);

            string currentTier = NormalizeTierName(tenant.SubscriptionTier);
            string normalizedNewTier = NormalizeTierName(newTier);

            if (string.Equals(currentTier, normalizedNewTier, StringComparison.Ordinal))
            {
                return await BuildSubscriptionDtoAsync(tenant, subscription, item, cancellationToken);
            }

            Result transitionValidationResult = ValidateTierTransition(currentTier, normalizedNewTier);
            if (transitionValidationResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(transitionValidationResult.Errors);
            }

            Result<SubscriptionTierLimits> newTierLimitsResult = _subscriptionTierService.GetTierLimits(normalizedNewTier);
            if (newTierLimitsResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(newTierLimitsResult.Errors);
            }

            Result<string> newPriceIdResult = _subscriptionTierService.GetTierPriceId(normalizedNewTier, parsedInterval);
            if (newPriceIdResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(newPriceIdResult.Errors);
            }

            Result<int> targetQuantityResult = await ResolveTargetQuantityForTierChangeAsync(
                tenantId,
                currentTier,
                normalizedNewTier,
                newTierLimitsResult.Value.MinimumSeats,
                cancellationToken);

            if (targetQuantityResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(targetQuantityResult.Errors);
            }

            int targetQuantity = targetQuantityResult.Value;
            Stripe.Subscription updatedSubscription = await UpdateStripeSubscriptionTierAsync(
                subscription,
                item,
                newPriceIdResult.Value,
                targetQuantity,
                cancellationToken);
            stripeTierUpdated = true;

            // Re-fetch after the price/quantity change. The update response can omit item billing
            // period timestamps (deserialized as DateTime.MinValue), and writing those to Postgres
            // fails the local transaction after Stripe has already moved — surfacing only a generic
            // "Failed to update subscription." error.
            updatedSubscription = await GetStripeSubscriptionAsync(updatedSubscription.Id, cancellationToken);
            Stripe.SubscriptionItem? updatedItem = updatedSubscription.Items?.Data?.FirstOrDefault();
            if (updatedItem == null)
            {
                await TryRestoreStripeTierUpdateWithTimeoutAsync(subscriptionId, subscriptionItemId, previousPriceId, previousQuantity);
                return Result.Fail<SubscriptionDto>(new NotFoundError("Updated Stripe subscription item was not returned."));
            }

            using (TransactionScope localTransaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled))
            {
                Result seatAdjustmentsResult = await ApplySeatAdjustmentsForTierChangeAsync(
                    tenantId,
                    currentTier,
                    normalizedNewTier,
                    targetQuantity,
                    cancellationToken);

                if (seatAdjustmentsResult.IsFailed)
                {
                    await TryRestoreStripeTierUpdateWithTimeoutAsync(subscriptionId, subscriptionItemId, previousPriceId, previousQuantity);
                    return Result.Fail<SubscriptionDto>(seatAdjustmentsResult.Errors);
                }

                ApplyStripeStateToTenant(tenant, updatedSubscription, updatedItem, normalizedNewTier);
                tenant.SubscriptionTier = normalizedNewTier;
                tenant.BillingCycle = parsedInterval.ToString();
                tenant.MaxUsers = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
                ApplyEffectiveLimitsToTenant(tenant, normalizedNewTier, tenant.SubscriptionStatus, tenant.MaxUsers);

                await _tenantRepository.UpdateAsync(tenant, cancellationToken);

                localTransaction.Complete();
                localChangesCommitted = true;
            }

            // Build the DTO outside the TransactionScope. Seat-summary / payment-method reads after
            // Complete() would otherwise hit "The current TransactionScope is already complete."
            return await BuildSubscriptionDtoAsync(tenant, updatedSubscription, updatedItem, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await TryRestoreStripeTierUpdateIfNeededWithTimeoutAsync(
                stripeTierUpdated,
                localChangesCommitted,
                subscriptionId,
                subscriptionItemId,
                previousPriceId,
                previousQuantity);

            throw;
        }
        catch (StripeException ex)
        {
            await TryRestoreStripeTierUpdateIfNeededWithTimeoutAsync(
                stripeTierUpdated,
                localChangesCommitted,
                subscriptionId,
                subscriptionItemId,
                previousPriceId,
                previousQuantity);

            _logger.LogError(ex, "Stripe subscription update failed for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>(BuildStripeError(ex, "Failed to update subscription."));
        }
        catch (Exception ex)
        {
            await TryRestoreStripeTierUpdateIfNeededWithTimeoutAsync(
                stripeTierUpdated,
                localChangesCommitted,
                subscriptionId,
                subscriptionItemId,
                previousPriceId,
                previousQuantity);

            _logger.LogError(ex, "Unexpected error updating subscription for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>(new BadRequestError($"Failed to update subscription: {ex.Message}"));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> CancelSubscriptionAsync(Guid tenantId, bool immediate, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)> contextResult =
                await GetTenantSubscriptionContextAsync(tenantId, cancellationToken);

            if (contextResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(contextResult.Errors);
            }

            (Tenant tenant, Stripe.Subscription subscription, Stripe.SubscriptionItem item) = contextResult.Value;

            SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
            Stripe.Subscription updatedSubscription;

            if (immediate)
            {
                SubscriptionCancelOptions cancelOptions = new SubscriptionCancelOptions
                {
                    InvoiceNow = false,
                    Prorate = false
                };

                updatedSubscription = await subscriptionService.CancelAsync(
                    subscription.Id,
                    cancelOptions,
                    requestOptions: null,
                    cancellationToken: cancellationToken);

                Result markCanceledResult = await MarkAllSeatsCanceledAsync(tenantId, cancellationToken);
                if (markCanceledResult.IsFailed)
                {
                    return Result.Fail<SubscriptionDto>(markCanceledResult.Errors);
                }
            }
            else
            {
                SubscriptionUpdateOptions cancelAtPeriodEndOptions = new SubscriptionUpdateOptions
                {
                    CancelAtPeriodEnd = true
                };

                updatedSubscription = await subscriptionService.UpdateAsync(
                    subscription.Id,
                    cancelAtPeriodEndOptions,
                    requestOptions: null,
                    cancellationToken: cancellationToken);
                Stripe.SubscriptionItem? periodEndItem = updatedSubscription.Items?.Data?.FirstOrDefault() ?? item;
                DateTimeOffset periodEnd = ToDateTimeOffset(periodEndItem.CurrentPeriodEnd);

                Result markPendingResult = await MarkAllSeatsPendingCancellationAsync(tenantId, periodEnd, cancellationToken);
                if (markPendingResult.IsFailed)
                {
                    return Result.Fail<SubscriptionDto>(markPendingResult.Errors);
                }
            }

            Stripe.SubscriptionItem? updatedItem = updatedSubscription.Items?.Data?.FirstOrDefault() ?? item;

            ApplyStripeStateToTenant(tenant, updatedSubscription, updatedItem, NormalizeTierName(tenant.SubscriptionTier));
            tenant.MaxUsers = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);

            await _tenantRepository.UpdateAsync(tenant, cancellationToken);

            return await BuildSubscriptionDtoAsync(tenant, updatedSubscription, updatedItem, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe subscription cancel failed for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>(BuildStripeError(ex, "Failed to cancel subscription."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error canceling subscription for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>("Failed to cancel subscription.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> ReactivateSubscriptionAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)> contextResult =
                await GetTenantSubscriptionContextAsync(tenantId, cancellationToken);

            if (contextResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(contextResult.Errors);
            }

            (Tenant tenant, Stripe.Subscription subscription, Stripe.SubscriptionItem item) = contextResult.Value;

            if (!subscription.CancelAtPeriodEnd)
            {
                return Result.Fail<SubscriptionDto>(new BadRequestError("Subscription is not scheduled for cancellation."));
            }

            SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
            SubscriptionUpdateOptions reactivateOptions = new SubscriptionUpdateOptions
            {
                CancelAtPeriodEnd = false
            };

            Stripe.Subscription reactivatedSubscription = await subscriptionService.UpdateAsync(
                subscription.Id,
                reactivateOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);
            Result reactivateSeatsResult = await ReactivatePendingSeatsAsync(tenantId, cancellationToken);
            if (reactivateSeatsResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(reactivateSeatsResult.Errors);
            }

            Stripe.SubscriptionItem? reactivatedItem = reactivatedSubscription.Items?.Data?.FirstOrDefault() ?? item;

            ApplyStripeStateToTenant(tenant, reactivatedSubscription, reactivatedItem, NormalizeTierName(tenant.SubscriptionTier));
            tenant.MaxUsers = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
            ApplyEffectiveLimitsToTenant(tenant, NormalizeTierName(tenant.SubscriptionTier), tenant.SubscriptionStatus, tenant.MaxUsers);

            await _tenantRepository.UpdateAsync(tenant, cancellationToken);

            return await BuildSubscriptionDtoAsync(tenant, reactivatedSubscription, reactivatedItem, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe subscription reactivation failed for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>(BuildStripeError(ex, "Failed to reactivate subscription."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error reactivating subscription for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>("Failed to reactivate subscription.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> ExtendTrialAsync(Guid tenantId, DateTimeOffset newTrialEnd, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)> contextResult =
                await GetTenantSubscriptionContextAsync(tenantId, cancellationToken);

            if (contextResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(contextResult.Errors);
            }

            (Tenant tenant, Stripe.Subscription subscription, Stripe.SubscriptionItem item) = contextResult.Value;

            if (!string.Equals(subscription.Status, "trialing", StringComparison.OrdinalIgnoreCase))
            {
                return Result.Fail<SubscriptionDto>(new BadRequestError("Subscription is not currently in a trial."));
            }

            if (newTrialEnd <= DateTimeOffset.UtcNow)
            {
                return Result.Fail<SubscriptionDto>(new BadRequestError("New trial end date must be in the future."));
            }

            if (subscription.TrialEnd.HasValue && newTrialEnd <= ToDateTimeOffset(subscription.TrialEnd.Value))
            {
                return Result.Fail<SubscriptionDto>(new BadRequestError("New trial end date must be later than the current trial end date."));
            }

            SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
            SubscriptionUpdateOptions extendOptions = new SubscriptionUpdateOptions
            {
                TrialEnd = newTrialEnd.UtcDateTime,
                ProrationBehavior = "none"
            };

            Stripe.Subscription updatedSubscription = await subscriptionService.UpdateAsync(
                subscription.Id,
                extendOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            Stripe.SubscriptionItem? updatedItem = updatedSubscription.Items?.Data?.FirstOrDefault() ?? item;

            ApplyStripeStateToTenant(tenant, updatedSubscription, updatedItem, NormalizeTierName(tenant.SubscriptionTier));
            tenant.MaxUsers = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
            ApplyEffectiveLimitsToTenant(tenant, NormalizeTierName(tenant.SubscriptionTier), tenant.SubscriptionStatus, tenant.MaxUsers);

            await _tenantRepository.UpdateAsync(tenant, cancellationToken);

            _logger.LogInformation(
                "Trial extended for tenant {TenantId}, subscription {SubscriptionId}, new trial end {TrialEnd}",
                tenantId, updatedSubscription.Id, newTrialEnd);

            return await BuildSubscriptionDtoAsync(tenant, updatedSubscription, updatedItem, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe trial extension failed for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>(BuildStripeError(ex, "Failed to extend trial."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error extending trial for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>("Failed to extend trial.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<InvoicePreviewDto>> GetUpcomingInvoiceAsync(Guid tenantId, string? newTier, string? billingInterval, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)> contextResult =
                await GetTenantSubscriptionContextAsync(tenantId, cancellationToken);

            if (contextResult.IsFailed)
            {
                return Result.Fail<InvoicePreviewDto>(contextResult.Errors);
            }

            (_, Stripe.Subscription subscription, Stripe.SubscriptionItem item) = contextResult.Value;
            DateTime prorationDate = DateTime.UtcNow;

            InvoiceCreatePreviewOptions previewOptions = new InvoiceCreatePreviewOptions
            {
                Customer = subscription.CustomerId,
                Subscription = subscription.Id
            };

            Result<InvoiceSubscriptionDetailsOptions?> previewDetailsResult = await BuildInvoicePreviewDetailsAsync(
                tenantId,
                newTier,
                billingInterval,
                item,
                prorationDate,
                cancellationToken);

            if (previewDetailsResult.IsFailed)
            {
                return Result.Fail<InvoicePreviewDto>(previewDetailsResult.Errors);
            }

            if (previewDetailsResult.Value != null)
            {
                previewOptions.SubscriptionDetails = previewDetailsResult.Value;
            }

            InvoiceService invoiceService = new InvoiceService(_stripeClient);
            Invoice preview = await invoiceService.CreatePreviewAsync(
                previewOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            return Result.Ok(MapInvoicePreview(preview, prorationDate));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe invoice preview failed for tenant {TenantId}", tenantId);
            return Result.Fail<InvoicePreviewDto>(BuildStripeError(ex, "Failed to preview upcoming invoice."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error previewing invoice for tenant {TenantId}", tenantId);
            return Result.Fail<InvoicePreviewDto>("Failed to preview upcoming invoice.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<Tenant>> SyncSubscriptionToTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)> contextResult =
                await GetTenantSubscriptionContextAsync(tenantId, cancellationToken);

            if (contextResult.IsFailed)
            {
                return Result.Fail<Tenant>(contextResult.Errors);
            }

            (Tenant tenant, Stripe.Subscription subscription, Stripe.SubscriptionItem item) = contextResult.Value;

            string resolvedTier = ResolveTierFromPrice(item.Price?.Id, tenant.SubscriptionTier);
            ApplyStripeStateToTenant(tenant, subscription, item, resolvedTier);
            cancellationToken.ThrowIfCancellationRequested();
            tenant.MaxUsers = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
            ApplyEffectiveLimitsToTenant(tenant, resolvedTier, tenant.SubscriptionStatus, tenant.MaxUsers);

            await _tenantRepository.UpdateAsync(tenant, cancellationToken);
            return Result.Ok(tenant);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe subscription sync failed for tenant {TenantId}", tenantId);
            return Result.Fail<Tenant>(BuildStripeError(ex, "Failed to synchronize subscription state."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error synchronizing subscription for tenant {TenantId}", tenantId);
            return Result.Fail<Tenant>("Failed to synchronize subscription state.");
        }
    }

    private async Task<Result<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)>> GetTenantSubscriptionContextAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        Result<Tenant> tenantResult = await GetActiveTenantAsync(tenantId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)>(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;
        if (string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId))
        {
            return Result.Fail<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)>(
                new NotFoundError("Tenant does not have an active Stripe subscription."));
        }

        Stripe.Subscription subscription = await GetStripeSubscriptionAsync(
            tenant.StripeSubscriptionId,
            cancellationToken);
        Stripe.SubscriptionItem? item = subscription.Items?.Data?.FirstOrDefault();

        if (item == null)
        {
            return Result.Fail<(Tenant Tenant, Stripe.Subscription Subscription, Stripe.SubscriptionItem Item)>(
                new NotFoundError("Stripe subscription item not found."));
        }

        return Result.Ok((tenant, subscription, item));
    }

    private async Task<Stripe.Subscription> GetStripeSubscriptionAsync(
        string stripeSubscriptionId,
        CancellationToken cancellationToken = default)
    {
        SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
        SubscriptionGetOptions getOptions = new()
        {
            Expand =
            [
                "discounts",
                "discounts.promotion_code",
                "discounts.source.coupon"
            ]
        };

        return await subscriptionService.GetAsync(
            stripeSubscriptionId,
            getOptions,
            requestOptions: null,
            cancellationToken: cancellationToken);
    }

    private async Task<Result<Tenant>> GetActiveTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => await GetActiveTenantCoreAsync(tenantId, forUpdate: false, cancellationToken);

    private async Task<Result<Tenant>> GetActiveTenantForBetaTrialAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
        => await GetActiveTenantCoreAsync(tenantId, forUpdate: true, cancellationToken);

    private async Task<Result<Tenant>> GetActiveTenantCoreAsync(
        Guid tenantId,
        bool forUpdate,
        CancellationToken cancellationToken)
    {
        Tenant? tenant = forUpdate
            ? await _tenantRepository.GetByIdForUpdateAsync(tenantId, cancellationToken)
            : await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);

        if (tenant == null)
        {
            return Result.Fail<Tenant>(new NotFoundError("Tenant not found."));
        }

        if (!tenant.IsActive)
        {
            return Result.Fail<Tenant>(new ForbiddenError("Tenant is inactive."));
        }

        return Result.Ok(tenant);
    }

    private static Result ValidateTierTransition(string currentTier, string newTier)
    {
        if (string.Equals(newTier, SubscriptionTierNames.Enterprise, StringComparison.Ordinal))
        {
            return Result.Fail(new ForbiddenError("Team to Enterprise upgrades are managed outside self-service."));
        }

        if (string.Equals(currentTier, SubscriptionTierNames.Enterprise, StringComparison.Ordinal))
        {
            return Result.Fail(new ForbiddenError("Enterprise subscription changes must be handled by an administrator."));
        }

        return Result.Ok();
    }

    private async Task<Result<int>> ResolveTargetQuantityForTierChangeAsync(
        Guid tenantId,
        string currentTier,
        string newTier,
        int newTierMinimumSeats,
        CancellationToken cancellationToken = default)
    {
        int currentSeatCount = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
        int targetQuantity = ResolveTargetQuantityForTierChange(currentTier, newTier, currentSeatCount, newTierMinimumSeats);

        if (string.Equals(currentTier, SubscriptionTierNames.Team, StringComparison.Ordinal)
            && string.Equals(newTier, SubscriptionTierNames.Individual, StringComparison.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            Result<SeatSummaryDto> summaryResult = await _seatManagementService.GetSeatSummaryAsync(tenantId, cancellationToken);
            if (summaryResult.IsFailed)
            {
                return Result.Fail<int>(summaryResult.Errors);
            }

            if (summaryResult.Value.OccupiedSeats > 1)
            {
                return Result.Fail<int>(new BadRequestError("Downgrade blocked: at most one occupied seat is allowed for Individual tier."));
            }
        }

        return Result.Ok(targetQuantity);
    }

    private async Task<Stripe.Subscription> UpdateStripeSubscriptionTierAsync(
        Stripe.Subscription subscription,
        Stripe.SubscriptionItem item,
        string newPriceId,
        int quantity,
        CancellationToken cancellationToken = default)
    {
        SubscriptionUpdateOptions updateOptions = new SubscriptionUpdateOptions
        {
            Items = new List<SubscriptionItemOptions>
            {
                new SubscriptionItemOptions
                {
                    Id = item.Id,
                    Price = newPriceId,
                    Quantity = quantity
                }
            },
            ProrationBehavior = "create_prorations"
        };

        SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
        return await subscriptionService.UpdateAsync(
            subscription.Id,
            updateOptions,
            requestOptions: null,
            cancellationToken: cancellationToken);
    }

    private async Task<Result> ApplySeatAdjustmentsForTierChangeAsync(
        Guid tenantId,
        string currentTier,
        string newTier,
        int targetQuantity,
        CancellationToken cancellationToken = default)
    {
        if (string.Equals(currentTier, SubscriptionTierNames.Team, StringComparison.Ordinal)
            && string.Equals(newTier, SubscriptionTierNames.Individual, StringComparison.Ordinal))
        {
            return await CollapseToSingleIndividualSeatAsync(tenantId, cancellationToken);
        }

        if (string.Equals(currentTier, SubscriptionTierNames.Individual, StringComparison.Ordinal)
            && string.Equals(newTier, SubscriptionTierNames.Team, StringComparison.Ordinal))
        {
            return await EnsureTeamSeatMinimumAsync(tenantId, targetQuantity, cancellationToken);
        }

        return Result.Ok();
    }

    private async Task<Result<InvoiceSubscriptionDetailsOptions?>> BuildInvoicePreviewDetailsAsync(
        Guid tenantId,
        string? newTier,
        string? billingInterval,
        Stripe.SubscriptionItem item,
        DateTime prorationDate,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(newTier))
        {
            return Result.Ok<InvoiceSubscriptionDetailsOptions?>(null);
        }

        string normalizedNewTier = NormalizeTierName(newTier);
        if (string.Equals(normalizedNewTier, SubscriptionTierNames.Enterprise, StringComparison.Ordinal))
        {
            return Result.Fail<InvoiceSubscriptionDetailsOptions?>(
                new ForbiddenError("Enterprise tier changes are managed outside self-service."));
        }

        BillingInterval parsedInterval = BillingInterval.Monthly;
        if (!string.IsNullOrWhiteSpace(billingInterval)
            && !BillingIntervalParser.TryParse(billingInterval, out parsedInterval))
        {
            return Result.Fail<InvoiceSubscriptionDetailsOptions?>($"Invalid billing interval '{billingInterval}'.");
        }

        Result<string> priceIdResult = _subscriptionTierService.GetTierPriceId(normalizedNewTier, parsedInterval);
        if (priceIdResult.IsFailed)
        {
            return Result.Fail<InvoiceSubscriptionDetailsOptions?>(priceIdResult.Errors);
        }

        Result<int> previewQuantityResult = await ResolvePreviewQuantityAsync(tenantId, normalizedNewTier, cancellationToken);
        if (previewQuantityResult.IsFailed)
        {
            return Result.Fail<InvoiceSubscriptionDetailsOptions?>(previewQuantityResult.Errors);
        }

        InvoiceSubscriptionDetailsOptions details = new InvoiceSubscriptionDetailsOptions
        {
            ProrationBehavior = "create_prorations",
            ProrationDate = prorationDate,
            Items = new List<InvoiceSubscriptionDetailsItemOptions>
            {
                new InvoiceSubscriptionDetailsItemOptions
                {
                    Id = item.Id,
                    Price = priceIdResult.Value,
                    Quantity = previewQuantityResult.Value
                }
            }
        };

        return Result.Ok<InvoiceSubscriptionDetailsOptions?>(details);
    }

    private async Task<Result<int>> ResolvePreviewQuantityAsync(Guid tenantId, string normalizedNewTier, CancellationToken cancellationToken = default)
    {
        int currentSeatCount = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);

        if (string.Equals(normalizedNewTier, SubscriptionTierNames.Individual, StringComparison.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            Result<SeatSummaryDto> summaryResult = await _seatManagementService.GetSeatSummaryAsync(tenantId, cancellationToken);
            if (summaryResult.IsFailed)
            {
                return Result.Fail<int>(summaryResult.Errors);
            }

            if (summaryResult.Value.OccupiedSeats > 1)
            {
                return Result.Fail<int>(new BadRequestError("Cannot preview Team to Individual downgrade while more than one seat is occupied."));
            }

            return Result.Ok(1);
        }

        Result<SubscriptionTierLimits> limitsResult = _subscriptionTierService.GetTierLimits(normalizedNewTier);
        if (limitsResult.IsFailed)
        {
            return Result.Fail<int>(limitsResult.Errors);
        }

        int quantity = Math.Max(Math.Max(currentSeatCount, 1), limitsResult.Value.MinimumSeats);
        return Result.Ok(quantity);
    }

    private async Task<Result> EnsureTeamSeatMinimumAsync(Guid tenantId, int minimumSeats, CancellationToken cancellationToken = default)
    {
        List<SubscriptionSeat> seats = [.. await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken)];

        foreach (SubscriptionSeat seat in seats)
        {
            cancellationToken.ThrowIfCancellationRequested();
            seat.User = null;
            seat.Tenant = null;
            seat.IsBundled = true;
            seat.Status = ActiveSeatStatus;
            seat.CanceledAt = null;
            seat.SeatEndDate = null;
            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);
        }

        int activeCount = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
        int seatsToCreate = Math.Max(0, minimumSeats - activeCount);

        if (seatsToCreate > 0)
        {
            DateTimeOffset now = DateTimeOffset.UtcNow;
            List<SubscriptionSeat> newSeats = new List<SubscriptionSeat>(seatsToCreate);

            for (int index = 0; index < seatsToCreate; index++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                SubscriptionSeat newSeat = new SubscriptionSeat
                {
                    TenantId = tenantId,
                    Status = ActiveSeatStatus,
                    IsBundled = true,
                    SeatStartDate = now,
                    CreatedOn = DateTime.UtcNow
                };

                newSeats.Add(newSeat);
            }

            await _subscriptionSeatRepository.AddRangeAsync(newSeats, cancellationToken);
        }

        return Result.Ok();
    }

    private async Task<Result> CollapseToSingleIndividualSeatAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        List<SubscriptionSeat> seats = (await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken))
            .OrderByDescending(seat => seat.UserId.HasValue)
            .ThenBy(seat => seat.SeatStartDate)
            .ThenBy(seat => seat.SubscriptionSeatId)
            .ToList();

        DateTimeOffset now = DateTimeOffset.UtcNow;

        if (seats.Count == 0)
        {
            SubscriptionSeat individualSeat = new SubscriptionSeat
            {
                TenantId = tenantId,
                Status = ActiveSeatStatus,
                IsBundled = true,
                SeatStartDate = now,
                CreatedOn = DateTime.UtcNow
            };

            await _subscriptionSeatRepository.AddRangeAsync([individualSeat], cancellationToken);
            return Result.Ok();
        }

        SubscriptionSeat keepSeat = seats[0];
        keepSeat.User = null;
        keepSeat.Tenant = null;
        keepSeat.IsBundled = true;
        keepSeat.Status = ActiveSeatStatus;
        keepSeat.CanceledAt = null;
        keepSeat.SeatEndDate = null;
        await _subscriptionSeatRepository.UpdateAsync(keepSeat, cancellationToken);

        foreach (SubscriptionSeat seat in seats.Where(seat => seat.SubscriptionSeatId != keepSeat.SubscriptionSeatId))
        {
            cancellationToken.ThrowIfCancellationRequested();

            seat.User = null;
            seat.Tenant = null;
            seat.Status = CanceledSeatStatus;
            seat.IsBundled = false;
            seat.CanceledAt = now;
            seat.SeatEndDate = now;
            seat.UserId = null;
            seat.AssignedAt = null;
            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);
        }

        return Result.Ok();
    }

    private async Task<Result> MarkAllSeatsPendingCancellationAsync(Guid tenantId, DateTimeOffset periodEnd, CancellationToken cancellationToken = default)
    {
        List<SubscriptionSeat> seats = [.. await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken)];
        DateTimeOffset now = DateTimeOffset.UtcNow;

        foreach (SubscriptionSeat seat in seats)
        {
            cancellationToken.ThrowIfCancellationRequested();

            seat.Status = PendingCancellationSeatStatus;
            seat.CanceledAt ??= now;
            seat.SeatEndDate = periodEnd;
            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);
        }

        return Result.Ok();
    }

    private async Task<Result> MarkAllSeatsCanceledAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        List<SubscriptionSeat> seats = [.. await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken)];
        DateTimeOffset now = DateTimeOffset.UtcNow;

        foreach (SubscriptionSeat seat in seats)
        {
            cancellationToken.ThrowIfCancellationRequested();

            seat.Status = CanceledSeatStatus;
            seat.CanceledAt ??= now;
            seat.SeatEndDate = now;
            seat.UserId = null;
            seat.AssignedAt = null;
            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);
        }

        return Result.Ok();
    }

    private async Task<Result> ReactivatePendingSeatsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        List<SubscriptionSeat> seats = (await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken))
            .Where(seat => string.Equals(seat.Status, PendingCancellationSeatStatus, StringComparison.Ordinal))
            .ToList();

        foreach (SubscriptionSeat seat in seats)
        {
            cancellationToken.ThrowIfCancellationRequested();

            seat.Status = ActiveSeatStatus;
            seat.CanceledAt = null;
            seat.SeatEndDate = null;
            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);
        }

        return Result.Ok();
    }

    private async Task TryCancelSubscriptionWithTimeoutAsync(string subscriptionId)
    {
        using CancellationTokenSource compensationTokenSource = new CancellationTokenSource(CompensationTimeout);
        await TryCancelSubscriptionAsync(subscriptionId, compensationTokenSource.Token);
    }

    private async Task TryRestoreStripeTierUpdateWithTimeoutAsync(
        string? subscriptionId,
        string? subscriptionItemId,
        string? previousPriceId,
        int previousQuantity)
    {
        using CancellationTokenSource compensationTokenSource = new CancellationTokenSource(CompensationTimeout);
        await TryRestoreStripeTierUpdateAsync(
            subscriptionId,
            subscriptionItemId,
            previousPriceId,
            previousQuantity,
            compensationTokenSource.Token);
    }

    private async Task TryRestoreStripeTierUpdateIfNeededWithTimeoutAsync(
        bool stripeTierUpdated,
        bool localChangesCommitted,
        string? subscriptionId,
        string? subscriptionItemId,
        string? previousPriceId,
        int previousQuantity)
    {
        if (!stripeTierUpdated || localChangesCommitted)
        {
            return;
        }

        using CancellationTokenSource compensationTokenSource = new CancellationTokenSource(CompensationTimeout);
        await TryRestoreStripeTierUpdateIfNeededAsync(
            stripeTierUpdated,
            localChangesCommitted,
            subscriptionId,
            subscriptionItemId,
            previousPriceId,
            previousQuantity,
            compensationTokenSource.Token);
    }

    private async Task TryCancelSubscriptionAsync(string subscriptionId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
        {
            return;
        }

        _logger.LogInformation("Attempting to roll back Stripe subscription {SubscriptionId} due to local initialization failure", subscriptionId);

        try
        {
            SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
            SubscriptionCancelOptions cancelOptions = new SubscriptionCancelOptions
            {
                InvoiceNow = false,
                Prorate = false
            };

            Stripe.Subscription subscription = await subscriptionService.CancelAsync(
                subscriptionId,
                cancelOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            _logger.LogInformation("Successfully rolled back Stripe subscription {SubscriptionId} due to local initialization failure; Status={Status}", subscriptionId, subscription.Status);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to roll back Stripe subscription {SubscriptionId} after local initialization failure", subscriptionId);
        }
    }

    private async Task TryRestoreStripeTierUpdateAsync(
        string? subscriptionId,
        string? subscriptionItemId,
        string? previousPriceId,
        int previousQuantity,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId)
            || string.IsNullOrWhiteSpace(subscriptionItemId)
            || string.IsNullOrWhiteSpace(previousPriceId)
            || previousQuantity <= 0)
        {
            return;
        }

        try
        {
            SubscriptionUpdateOptions rollbackOptions = new SubscriptionUpdateOptions
            {
                Items = new List<SubscriptionItemOptions>
                {
                    new SubscriptionItemOptions
                    {
                        Id = subscriptionItemId,
                        Price = previousPriceId,
                        Quantity = previousQuantity
                    }
                },
                ProrationBehavior = "none"
            };

            SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
            await subscriptionService.UpdateAsync(
                subscriptionId,
                rollbackOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to restore Stripe subscription {SubscriptionId} to its previous tier state after local update failure",
                subscriptionId);
        }
    }

    private async Task TryRestoreStripeTierUpdateIfNeededAsync(
        bool stripeTierUpdated,
        bool localChangesCommitted,
        string? subscriptionId,
        string? subscriptionItemId,
        string? previousPriceId,
        int previousQuantity,
        CancellationToken cancellationToken = default)
    {
        if (!stripeTierUpdated || localChangesCommitted)
        {
            return;
        }

        await TryRestoreStripeTierUpdateAsync(
            subscriptionId,
            subscriptionItemId,
            previousPriceId,
            previousQuantity,
            cancellationToken);
    }

    private async Task<PaymentMethodDto?> GetDefaultPaymentMethodAsync(Stripe.Subscription subscription, CancellationToken cancellationToken = default)
    {
        string? paymentMethodId = subscription.DefaultPaymentMethodId;

        if (string.IsNullOrWhiteSpace(paymentMethodId) && !string.IsNullOrWhiteSpace(subscription.CustomerId))
        {
            CustomerService customerService = new CustomerService(_stripeClient);
            Customer customer = await customerService.GetAsync(
                subscription.CustomerId,
                requestOptions: null,
                cancellationToken: cancellationToken);
            paymentMethodId = customer.InvoiceSettings?.DefaultPaymentMethodId;
        }

        if (string.IsNullOrWhiteSpace(paymentMethodId))
        {
            return null;
        }

        PaymentMethodService paymentMethodService = new PaymentMethodService(_stripeClient);
        PaymentMethod paymentMethod = await paymentMethodService.GetAsync(
            paymentMethodId,
            requestOptions: null,
            cancellationToken: cancellationToken);

        if (paymentMethod.Card == null)
        {
            return null;
        }

        return new PaymentMethodDto
        {
            Id = paymentMethod.Id ?? paymentMethodId,
            Brand = string.IsNullOrWhiteSpace(paymentMethod.Card.Brand) ? "unknown" : paymentMethod.Card.Brand,
            Last4 = paymentMethod.Card.Last4 ?? string.Empty,
            ExpMonth = (int)paymentMethod.Card.ExpMonth,
            ExpYear = (int)paymentMethod.Card.ExpYear,
            IsDefault = true
        };
    }

    private async Task<Result<SubscriptionDto>> BuildSubscriptionDtoAsync(
        Tenant tenant,
        Stripe.Subscription subscription,
        Stripe.SubscriptionItem item,
        CancellationToken cancellationToken = default)
    {
        PaymentMethodDto? defaultPaymentMethod = await GetDefaultPaymentMethodAsync(subscription, cancellationToken);

        cancellationToken.ThrowIfCancellationRequested();
        Result<SeatSummaryDto> seatSummaryResult = await _seatManagementService.GetSeatSummaryAsync(tenant.TenantId, cancellationToken);
        SeatSummaryDto? seatSummary = seatSummaryResult.IsSuccess ? seatSummaryResult.Value : null;

        int totalSeats;
        if (seatSummary != null)
        {
            totalSeats = seatSummary.TotalSeats;
        }
        else
        {
            cancellationToken.ThrowIfCancellationRequested();
            totalSeats = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenant.TenantId, cancellationToken);
        }

        string tier = ResolveTierFromPrice(item.Price?.Id, tenant.SubscriptionTier);
        string billingInterval = ResolveIntervalFromPrice(item.Price?.Id);

        DateTime currentPeriodStart = IsUsableStripeTimestamp(item.CurrentPeriodStart)
            ? ToDateTimeOffset(item.CurrentPeriodStart).UtcDateTime
            : (tenant.SubscriptionStartDate?.UtcDateTime ?? DateTime.UtcNow);
        DateTime currentPeriodEnd = IsUsableStripeTimestamp(item.CurrentPeriodEnd)
            ? ToDateTimeOffset(item.CurrentPeriodEnd).UtcDateTime
            : (tenant.SubscriptionEndDate?.UtcDateTime ?? DateTime.UtcNow);

        SubscriptionDto dto = new SubscriptionDto
        {
            Id = subscription.Id,
            Tier = tier,
            BillingInterval = billingInterval,
            Status = subscription.Status,
            CurrentPeriodStart = currentPeriodStart,
            CurrentPeriodEnd = currentPeriodEnd,
            CancelAtPeriodEnd = subscription.CancelAtPeriodEnd,
            CanceledAt = ToNullableDateTime(subscription.CanceledAt),
            DefaultPaymentMethod = defaultPaymentMethod,
            SeatSummary = seatSummary,
            TotalSeats = totalSeats,
            Discount = MapSubscriptionDiscount(subscription.Discounts),
            AllowsComplimentarySeatManagement = _internalDevTenantService.IsInternalDevTenant(tenant.TenantId)
        };

        return Result.Ok(dto);
    }

    private async Task RecordPromoAppliedHistoryAsync(
        Guid tenantId,
        string normalizedTier,
        BillingInterval billingInterval,
        PromoCodeResolution promoResolution,
        CancellationToken cancellationToken)
    {
        string notes = JsonSerializer.Serialize(new
        {
            promoCode = promoResolution.Code,
            couponId = promoResolution.CouponId,
            promotionCodeId = promoResolution.PromotionCodeId,
            freeMonths = promoResolution.FreeMonths,
            discountEndsAt = promoResolution.DiscountEndsAt
        });

        SubscriptionHistory history = new SubscriptionHistory
        {
            TenantId = tenantId,
            EventType = SubscriptionHistoryEventTypes.PromoApplied,
            SubscriptionTier = normalizedTier,
            BillingCycle = billingInterval.ToString(),
            Notes = notes,
            EventDate = DateTime.UtcNow
        };

        cancellationToken.ThrowIfCancellationRequested();
        await _subscriptionHistoryRepository.AddAsync(history);
    }

    private static SubscriptionDiscountDto? MapSubscriptionDiscount(IList<Stripe.Discount>? discounts)
    {
        Stripe.Discount? discount = discounts?.FirstOrDefault();
        if (discount == null)
        {
            return null;
        }

        Coupon? coupon = discount.Source?.Coupon;
        decimal percentOff = coupon?.PercentOff ?? 0m;
        int freeMonths = Convert.ToInt32(coupon?.DurationInMonths ?? 0);
        DateTime? discountEndsAt = discount.End.HasValue
            ? ToDateTimeOffset(discount.End.Value).UtcDateTime
            : null;

        return new SubscriptionDiscountDto
        {
            PromoCode = discount.PromotionCode?.Code,
            FreeMonths = freeMonths,
            DiscountEndsAt = discountEndsAt,
            PercentOff = percentOff
        };
    }

    private static InvoicePreviewDto MapInvoicePreview(Invoice preview, DateTime prorationDate)
    {
        List<InvoiceLineItem> stripeLineItems = preview.Lines?.Data?.ToList() ?? new List<InvoiceLineItem>();
        List<InvoiceLineItemDto> lineItems = new List<InvoiceLineItemDto>(stripeLineItems.Count);

        foreach (InvoiceLineItem lineItem in stripeLineItems)
        {
            InvoiceLineItemDto dto = new InvoiceLineItemDto
            {
                Description = lineItem.Description ?? "",
                Amount = lineItem.Amount / 100m,
                Currency = string.IsNullOrWhiteSpace(lineItem.Currency) ? "USD" : lineItem.Currency.ToUpperInvariant(),
                Quantity = ToLineItemQuantity(lineItem.Quantity)
            };

            lineItems.Add(dto);
        }

        InvoicePreviewDto previewDto = new InvoicePreviewDto
        {
            Amount = preview.Total / 100m,
            Currency = string.IsNullOrWhiteSpace(preview.Currency) ? "USD" : preview.Currency.ToUpperInvariant(),
            LineItems = lineItems,
            ProrationDate = prorationDate
        };

        return previewDto;
    }

    private static int ResolveInitialQuantity(string normalizedTier, int minimumSeats)
    {
        if (string.Equals(normalizedTier, SubscriptionTierNames.Team, StringComparison.Ordinal))
        {
            return Math.Max(minimumSeats, 1);
        }

        return 1;
    }

    private static int ResolveTargetQuantityForTierChange(string currentTier, string newTier, int currentSeatCount, int newTierMinimumSeats)
    {
        if (string.Equals(newTier, SubscriptionTierNames.Individual, StringComparison.Ordinal))
        {
            return 1;
        }

        if (string.Equals(newTier, SubscriptionTierNames.Team, StringComparison.Ordinal)
            && string.Equals(currentTier, SubscriptionTierNames.Individual, StringComparison.Ordinal))
        {
            return Math.Max(Math.Max(currentSeatCount, 1), newTierMinimumSeats);
        }

        return Math.Max(currentSeatCount, 1);
    }

    /// <summary>
    /// Sets the tenant's tier and recomputes its effective app/workspace limits from the tier,
    /// current subscription status, and active seat count. Per-seat tiers scale their limits by
    /// the seat count; trialing tiers use their trial limits. Call after the status and seat count
    /// have been set on the tenant.
    /// </summary>
    private void ApplyEffectiveLimitsToTenant(Tenant tenant, string tier, string status, int seatCount)
    {
        tenant.SubscriptionTier = tier;

        Result<EffectiveTierLimits> limitsResult = _subscriptionTierService.ResolveEffectiveLimits(tier, status, seatCount);
        if (limitsResult.IsFailed)
        {
            _logger.LogWarning(
                "Could not resolve effective limits for tenant {TenantId} (tier {Tier}, status {Status}, seats {SeatCount}): {Errors}",
                tenant.TenantId, tier, status, seatCount, string.Join("; ", limitsResult.Errors.Select(e => e.Message)));
            return;
        }

        tenant.MaxPublishedApps = limitsResult.Value.MaxPublishedApps;
        tenant.MaxWorkspaceConnections = limitsResult.Value.MaxWorkspaceConnections;
    }

    private static void ApplyStripeStateToTenant(Tenant tenant, Stripe.Subscription subscription, Stripe.SubscriptionItem item, string tier)
    {
        tenant.StripeSubscriptionId = subscription.Id;
        tenant.SubscriptionTier = tier;
        tenant.SubscriptionStatus = subscription.Status;
        // Stripe update payloads can omit item period fields; Stripe.net then deserializes them as
        // DateTime.MinValue. Writing that to Postgres throws and rolls back the local transaction.
        if (IsUsableStripeTimestamp(item.CurrentPeriodStart))
        {
            tenant.SubscriptionStartDate = ToDateTimeOffset(item.CurrentPeriodStart);
        }

        if (IsUsableStripeTimestamp(item.CurrentPeriodEnd))
        {
            tenant.SubscriptionEndDate = ToDateTimeOffset(item.CurrentPeriodEnd);
        }

        tenant.CancelAtPeriodEnd = subscription.CancelAtPeriodEnd;

        if (subscription.TrialEnd.HasValue && IsUsableStripeTimestamp(subscription.TrialEnd.Value))
        {
            tenant.TrialEndDate = ToDateTimeOffset(subscription.TrialEnd.Value);
        }

        if (string.Equals(subscription.Status, SubscriptionStatusNames.Canceled, StringComparison.OrdinalIgnoreCase)
            || string.Equals(subscription.Status, SubscriptionStatusNames.Paused, StringComparison.OrdinalIgnoreCase))
        {
            tenant.MaxUsers = 0;
        }
    }

    /// <summary>
    /// Returns true when <paramref name="value"/> looks like a real Stripe billing timestamp
    /// rather than a missing/default <see cref="DateTime"/> (year 1).
    /// </summary>
    private static bool IsUsableStripeTimestamp(DateTime value) => value.Year >= 1970;

    private string ResolveTierFromPrice(string? priceId, string fallbackTier)
    {
        if (!string.IsNullOrWhiteSpace(priceId))
        {
            Result<(SubscriptionTier Tier, BillingInterval Interval)> tierFromPriceResult = _subscriptionTierService.GetTierFromPriceId(priceId);
            if (tierFromPriceResult.IsSuccess)
            {
                return tierFromPriceResult.Value.Tier.ToString();
            }
        }

        return NormalizeTierName(fallbackTier);
    }

    /// <summary>
    /// Resolves the current billing interval from the active Stripe price, as a
    /// <see cref="BillingInterval"/> name ("Monthly"/"Yearly"). Falls back to
    /// <see cref="BillingInterval.Monthly"/> when the price cannot be resolved.
    /// </summary>
    private string ResolveIntervalFromPrice(string? priceId)
    {
        if (!string.IsNullOrWhiteSpace(priceId))
        {
            Result<(SubscriptionTier Tier, BillingInterval Interval)> tierFromPriceResult = _subscriptionTierService.GetTierFromPriceId(priceId);
            if (tierFromPriceResult.IsSuccess)
            {
                return tierFromPriceResult.Value.Interval.ToString();
            }
        }

        // The interval could not be resolved from the price (unmapped/legacy/promo price, or a
        // missing price id). There is no persisted interval to fall back to, so we default to
        // Monthly — log it, because if the subscriber was actually on annual billing this value
        // is echoed back on their next tier change and would silently switch them to monthly.
        _logger.LogWarning(
            "Could not resolve billing interval for price {PriceId}; defaulting to Monthly", priceId);
        return BillingInterval.Monthly.ToString();
    }

    private static string NormalizeTierName(string tier) => SubscriptionTierNormalizer.Normalize(tier);

    private static DateTimeOffset ToDateTimeOffset(DateTime value)
    {
        DateTime utcDateTime = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

        return new DateTimeOffset(utcDateTime);
    }

    private static DateTime? ToNullableDateTime(DateTime? value)
    {
        return value?.ToUniversalTime();
    }

    private static int ToLineItemQuantity(long? quantity)
    {
        return quantity.HasValue ? Convert.ToInt32(quantity.Value) : 0;
    }

    private static BadRequestError BuildStripeError(StripeException stripeException, string fallbackMessage)
    {
        string? stripeMessage = stripeException.StripeError?.Message;
        if (string.IsNullOrWhiteSpace(stripeMessage))
        {
            stripeMessage = stripeException.Message;
        }

        string safeMessage = string.IsNullOrWhiteSpace(stripeMessage) ? fallbackMessage : stripeMessage;

        return new BadRequestError(safeMessage);
    }
}
