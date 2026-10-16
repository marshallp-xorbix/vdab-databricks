using FluentResults;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;
using System.Text.Json;
using System.Transactions;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for validating and processing Stripe webhook events with idempotency.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="StripeWebhookService"/> class.
/// </remarks>
public class StripeWebhookService(
    ILogger<StripeWebhookService> _logger,
    StripeWebhookRepositorySet _repositorySet,
    ISubscriptionTierService _subscriptionTierService,
    ISeatManagementService _seatManagementService,
    IStripeSubscriptionService _stripeSubscriptionService,
    IEmailSenderService _emailSenderService,
    IOptions<StripeSettings> stripeSettingsOptions) : IStripeWebhookService
{
    private const string ActiveSeatStatus = "Active";
    private const string CanceledSeatStatus = "Canceled";
    private const string PendingCancellationSeatStatus = "PendingCancellation";

    /// <inheritdoc/>
    public async Task<Result> HandleWebhookAsync(string payload, string signature, CancellationToken cancellationToken = default)
    {
        Result<Event> validatedEventResult = ValidateSignatureAsync(payload, signature);
        if (validatedEventResult.IsFailed)
        {
            _logger.LogWarning("Stripe webhook signature validation failed: {Errors}", string.Join(" | ", validatedEventResult.Errors.Select(error => error.Message)));
            return Result.Fail(validatedEventResult.Errors);
        }

        Event stripeEvent = validatedEventResult.Value;
        if (string.IsNullOrWhiteSpace(stripeEvent.Id))
        {
            _logger.LogWarning("Stripe event identifier is missing.");
            return Result.Fail(new BadRequestError("Stripe event identifier is missing."));
        }

        cancellationToken.ThrowIfCancellationRequested();
        bool alreadyProcessed = await _repositorySet.StripeEventLogRepository.ExistsAsync(stripeEvent.Id);
        if (alreadyProcessed)
        {
            _logger.LogInformation("Stripe event {EventId} ({EventType}) is already processed.", stripeEvent.Id, stripeEvent.Type);
            return Result.Ok();
        }

        _logger.LogInformation("Dispatching Stripe event {EventId} ({EventType}) for processing.", stripeEvent.Id, stripeEvent.Type);

        try
        {
            Result processResult = await ProcessStripeEventAsync(stripeEvent, cancellationToken);
            if (processResult.IsSuccess)
            {
                _logger.LogInformation("Successfully processed Stripe event {EventId} ({EventType}).", stripeEvent.Id, stripeEvent.Type);
            }
            else
            {
                _logger.LogWarning("Processing Stripe event {EventId} ({EventType}) failed: {Errors}",
                    stripeEvent.Id,
                    stripeEvent.Type,
                    string.Join(" | ", processResult.Errors.Select(error => error.Message)));
            }

            await SafeLogEventAsync(stripeEvent, payload,
                processResult.IsSuccess,
                processResult.IsSuccess ? null : string.Join(" | ", processResult.Errors.Select(error => error.Message)));

            return processResult.IsSuccess
                ? Result.Ok()
                : Result.Fail(processResult.Errors);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error while processing Stripe event {EventId} ({EventType})", stripeEvent.Id, stripeEvent.Type);

            await SafeLogEventAsync(stripeEvent, payload, success: false, errorMessage: ex.Message);

            return Result.Fail(new BadRequestError("Failed to process Stripe webhook event."));
        }
    }

    /// <inheritdoc/>
    public Result<Event> ValidateSignatureAsync(string payload, string signature)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return Result.Fail<Event>(new ValidationError("Webhook payload is required."));
        }

        if (string.IsNullOrWhiteSpace(signature))
        {
            return Result.Fail<Event>(new ValidationError("Stripe-Signature header is required."));
        }

        if (string.IsNullOrWhiteSpace(stripeSettingsOptions.Value.WebhookSecret))
        {
            return Result.Fail<Event>(new BadRequestError("Stripe webhook secret is not configured."));
        }

        try
        {
            Event stripeEvent = EventUtility.ConstructEvent(
                payload,
                signature,
                stripeSettingsOptions.Value.WebhookSecret,
                throwOnApiVersionMismatch: false);
            return Result.Ok(stripeEvent);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Stripe webhook signature validation failed.");
            return Result.Fail<Event>(new UnauthorizedError("Invalid Stripe webhook signature."));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stripe webhook payload could not be parsed.");
            return Result.Fail<Event>(new BadRequestError("Invalid Stripe webhook payload."));
        }
    }

    private async Task<Result> ProcessStripeEventAsync(Event stripeEvent, CancellationToken cancellationToken = default)
    {
        return stripeEvent.Type switch
        {
            EventTypes.CustomerSubscriptionCreated => await HandleSubscriptionCreatedOrUpdatedAsync(stripeEvent, "Created", cancellationToken),
            EventTypes.CustomerSubscriptionUpdated => await HandleSubscriptionCreatedOrUpdatedAsync(stripeEvent, "Updated", cancellationToken),
            EventTypes.CustomerSubscriptionPaused => await HandleSubscriptionCreatedOrUpdatedAsync(stripeEvent, "Paused", cancellationToken),
            EventTypes.CustomerSubscriptionResumed => await HandleSubscriptionCreatedOrUpdatedAsync(stripeEvent, "Resumed", cancellationToken),
            EventTypes.CustomerSubscriptionDeleted => await HandleSubscriptionDeletedAsync(stripeEvent, cancellationToken),
            EventTypes.InvoicePaid => await HandleInvoicePaidAsync(stripeEvent, cancellationToken),
            EventTypes.InvoicePaymentFailed => await HandleInvoicePaymentFailedAsync(stripeEvent, cancellationToken),
            EventTypes.InvoiceSent => await HandleInvoiceSentAsync(stripeEvent, cancellationToken),
            EventTypes.InvoiceUpcoming => await HandleInvoiceUpcomingAsync(stripeEvent, cancellationToken),
            EventTypes.CustomerSubscriptionTrialWillEnd => await HandleTrialWillEndAsync(stripeEvent, cancellationToken),
            EventTypes.CustomerUpdated => await HandleCustomerUpdatedAsync(stripeEvent, cancellationToken),
            _ => HandleIgnoredEvent(stripeEvent)
        };
    }

    private Result HandleIgnoredEvent(Event stripeEvent)
    {
        _logger.LogDebug("Stripe event type {EventType} is not handled explicitly and will be ignored.", stripeEvent.Type);
        return Result.Ok();
    }

    private async Task<Result> HandleSubscriptionCreatedOrUpdatedAsync(Event stripeEvent, string historyEventType, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("HandleSubscriptionCreatedOrUpdatedAsync started for event {EventId} ({EventType}), historyEventType={HistoryEventType}",
            stripeEvent.Id, stripeEvent.Type, historyEventType);

        Result<Stripe.Subscription> subscriptionResult = GetSubscriptionFromEvent(stripeEvent);
        if (subscriptionResult.IsFailed)
        {
            return Result.Fail(subscriptionResult.Errors);
        }

        Stripe.Subscription subscription = subscriptionResult.Value;
        Stripe.SubscriptionItem? subscriptionItem = subscription.Items?.Data?.FirstOrDefault();
        if (subscriptionItem == null)
        {
            return Result.Fail(new NotFoundError("Stripe subscription item was not found in webhook payload."));
        }

        Result<Tenant> tenantResult = await ResolveTenantAsync(subscription.CustomerId, subscription.Id, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;
        _logger.LogDebug("Resolved tenant {TenantId} ({TenantName}) for Stripe subscription {SubscriptionId} (status={Status}, quantity={Quantity}).",
            tenant.TenantId, tenant.TenantName, subscription.Id, subscription.Status, subscriptionItem.Quantity);

        using TransactionScope transaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);

        tenant.BillingCustomerId = string.IsNullOrWhiteSpace(tenant.BillingCustomerId)
            ? subscription.CustomerId
            : tenant.BillingCustomerId;

        tenant.StripeSubscriptionId = subscription.Id;
        tenant.SubscriptionStatus = subscription.Status;
        tenant.CancelAtPeriodEnd = subscription.CancelAtPeriodEnd;
        tenant.SubscriptionStartDate = ToDateTimeOffset(subscriptionItem.CurrentPeriodStart);
        tenant.SubscriptionEndDate = ToDateTimeOffset(subscriptionItem.CurrentPeriodEnd);

        if (subscription.TrialEnd.HasValue)
        {
            tenant.TrialEndDate = ToDateTimeOffset(subscription.TrialEnd.Value);
        }

        ApplyTierFromPrice(tenant, subscriptionItem.Price?.Id);

        int targetQuantity = ToSubscriptionQuantity(subscriptionItem.Quantity);
        Result reconcileResult = await ReconcileSeatsWithStripeQuantityAsync(tenant.TenantId, targetQuantity, cancellationToken);
        if (reconcileResult.IsFailed)
        {
            return Result.Fail(reconcileResult.Errors);
        }

        int seatCount = await _repositorySet.SubscriptionSeatRepository.GetTotalActiveCountAsync(tenant.TenantId);
        tenant.MaxUsers = seatCount;
        ApplyEffectiveLimitsToTenant(tenant, seatCount);

        await _repositorySet.TenantRepository.UpdateAsync(tenant);

        SubscriptionHistory history = BuildSubscriptionHistory(
            tenant,
            new SubscriptionHistoryBuildRequest
            {
                EventType = historyEventType,
                Amount = null,
                Currency = "USD",
                StripeInvoiceId = null,
                StripePaymentIntentId = null,
                ExternalTransactionId = subscription.Id,
                PaymentStatus = null,
                StripeEventId = stripeEvent.Id,
                Notes = BuildNotes(new
                {
                    StripeEventId = stripeEvent.Id,
                    StripeEventType = stripeEvent.Type,
                    SeatCount = seatCount,
                    Quantity = targetQuantity
                })
            });

        await _repositorySet.SubscriptionHistoryRepository.AddAsync(history);

        transaction.Complete();

        _logger.LogInformation("HandleSubscriptionCreatedOrUpdatedAsync completed for tenant {TenantId}, subscription {SubscriptionId}, status={Status}, seatCount={SeatCount}.",
            tenant.TenantId, subscription.Id, subscription.Status, seatCount);

        return Result.Ok();
    }

    private async Task<Result> HandleSubscriptionDeletedAsync(Event stripeEvent, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("HandleSubscriptionDeletedAsync started for event {EventId}.", stripeEvent.Id);

        Result<Stripe.Subscription> subscriptionResult = GetSubscriptionFromEvent(stripeEvent);
        if (subscriptionResult.IsFailed)
        {
            return Result.Fail(subscriptionResult.Errors);
        }

        Stripe.Subscription subscription = subscriptionResult.Value;
        Result<Tenant> tenantResult = await ResolveTenantAsync(subscription.CustomerId, subscription.Id, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;

        using TransactionScope transaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);

        Result cancelSeatsResult = await CancelAllSeatsAsync(tenant.TenantId, cancellationToken);
        if (cancelSeatsResult.IsFailed)
        {
            return Result.Fail(cancelSeatsResult.Errors);
        }

        tenant.SubscriptionStatus = "canceled";
        tenant.CancelAtPeriodEnd = false;
        tenant.SubscriptionEndDate = DateTimeOffset.UtcNow;
        tenant.MaxUsers = 0;

        await _repositorySet.TenantRepository.UpdateAsync(tenant);

        SubscriptionHistory history = BuildSubscriptionHistory(
            tenant,
            new SubscriptionHistoryBuildRequest
            {
                EventType = "Cancelled",
                Amount = null,
                Currency = "USD",
                StripeInvoiceId = null,
                StripePaymentIntentId = null,
                ExternalTransactionId = subscription.Id,
                PaymentStatus = "Completed",
                StripeEventId = stripeEvent.Id,
                Notes = BuildNotes(new
                {
                    StripeEventId = stripeEvent.Id,
                    StripeEventType = stripeEvent.Type,
                    SeatCount = 0
                })
            });

        await _repositorySet.SubscriptionHistoryRepository.AddAsync(history);

        transaction.Complete();

        _logger.LogInformation("HandleSubscriptionDeletedAsync completed for tenant {TenantId}, subscription {SubscriptionId}; all seats canceled.",
            tenant.TenantId, subscription.Id);

        await NotifySubscriptionCanceledAsync(tenant, cancellationToken);

        return Result.Ok();
    }

    private async Task<Result> HandleInvoicePaidAsync(Event stripeEvent, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("HandleInvoicePaidAsync started for event {EventId}.", stripeEvent.Id);

        Result<Invoice> invoiceResult = GetInvoiceFromEvent(stripeEvent);
        if (invoiceResult.IsFailed)
        {
            return Result.Fail(invoiceResult.Errors);
        }

        Invoice invoice = invoiceResult.Value;
        string? subscriptionId = GetInvoiceSubscriptionId(invoice);
        Result<Tenant> tenantResult = await ResolveTenantAsync(invoice.CustomerId, subscriptionId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;

        using TransactionScope transaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);

        int finalizedCancellationCount = 0;
        if (!string.IsNullOrWhiteSpace(subscriptionId))
        {
            Result<int> finalizeResult = await _seatManagementService.ProcessPeriodEndCancellationsAsync(tenant.TenantId);
            if (finalizeResult.IsFailed)
            {
                return Result.Fail(finalizeResult.Errors);
            }

            finalizedCancellationCount = finalizeResult.Value;

            Result<Tenant> syncResult = await _stripeSubscriptionService.SyncSubscriptionToTenantAsync(tenant.TenantId, cancellationToken);
            if (syncResult.IsFailed)
            {
                return Result.Fail(syncResult.Errors);
            }

            tenant = syncResult.Value;
        }

        int seatCount = await _repositorySet.SubscriptionSeatRepository.GetTotalActiveCountAsync(tenant.TenantId);

        SubscriptionHistory history = BuildSubscriptionHistory(
            tenant,
            new SubscriptionHistoryBuildRequest
            {
                EventType = "Renewed",
                Amount = ConvertStripeAmount(invoice.AmountPaid),
                Currency = NormalizeCurrency(invoice.Currency),
                StripeInvoiceId = invoice.Id,
                StripePaymentIntentId = GetInvoicePaymentIntentId(invoice),
                ExternalTransactionId = invoice.Id,
                PaymentStatus = "Completed",
                StripeEventId = stripeEvent.Id,
                Notes = BuildNotes(new
                {
                    StripeEventId = stripeEvent.Id,
                    StripeEventType = stripeEvent.Type,
                    SeatCount = seatCount,
                    BillingReason = invoice.BillingReason,
                    FinalizedPendingSeatCancellations = finalizedCancellationCount
                })
            });

        await _repositorySet.SubscriptionHistoryRepository.AddAsync(history);

        transaction.Complete();

        _logger.LogInformation("HandleInvoicePaidAsync completed for tenant {TenantId}, invoice {InvoiceId}, amountPaid={AmountPaid}, seatCount={SeatCount}, finalizedCancellations={FinalizedCancellations}.",
            tenant.TenantId, invoice.Id, invoice.AmountPaid, seatCount, finalizedCancellationCount);

        await NotifySubscriptionRenewedAsync(tenant, seatCount, cancellationToken);

        return Result.Ok();
    }

    private async Task<Result> HandleInvoicePaymentFailedAsync(Event stripeEvent, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("HandleInvoicePaymentFailedAsync started for event {EventId}.", stripeEvent.Id);

        Result<Invoice> invoiceResult = GetInvoiceFromEvent(stripeEvent);
        if (invoiceResult.IsFailed)
        {
            return Result.Fail(invoiceResult.Errors);
        }

        Invoice invoice = invoiceResult.Value;
        string? subscriptionId = GetInvoiceSubscriptionId(invoice);
        Result<Tenant> tenantResult = await ResolveTenantAsync(invoice.CustomerId, subscriptionId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;

        using TransactionScope transaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);

        tenant.SubscriptionStatus = "past_due";
        await _repositorySet.TenantRepository.UpdateAsync(tenant);

        int seatCount = await _repositorySet.SubscriptionSeatRepository.GetTotalActiveCountAsync(tenant.TenantId);

        SubscriptionHistory history = BuildSubscriptionHistory(
            tenant,
            new SubscriptionHistoryBuildRequest
            {
                EventType = "Payment",
                Amount = ConvertStripeAmount(invoice.AmountDue),
                Currency = NormalizeCurrency(invoice.Currency),
                StripeInvoiceId = invoice.Id,
                StripePaymentIntentId = GetInvoicePaymentIntentId(invoice),
                ExternalTransactionId = invoice.Id,
                PaymentStatus = "Failed",
                StripeEventId = stripeEvent.Id,
                Notes = BuildNotes(new
                {
                    StripeEventId = stripeEvent.Id,
                    StripeEventType = stripeEvent.Type,
                    SeatCount = seatCount,
                    BillingReason = invoice.BillingReason
                })
            });

        await _repositorySet.SubscriptionHistoryRepository.AddAsync(history);

        transaction.Complete();

        _logger.LogWarning("HandleInvoicePaymentFailedAsync completed for tenant {TenantId}, invoice {InvoiceId}, amountDue={AmountDue}, billingReason={BillingReason}.",
            tenant.TenantId, invoice.Id, invoice.AmountDue, invoice.BillingReason);

        await NotifyPaymentFailedAsync(tenant, invoice.Id, cancellationToken);

        return Result.Ok();
    }

    private async Task<Result> HandleInvoiceSentAsync(Event stripeEvent, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("HandleInvoiceSentAsync started for event {EventId}.", stripeEvent.Id);

        Result<Invoice> invoiceResult = GetInvoiceFromEvent(stripeEvent);
        if (invoiceResult.IsFailed)
        {
            return Result.Fail(invoiceResult.Errors);
        }

        Invoice invoice = invoiceResult.Value;
        string? subscriptionId = GetInvoiceSubscriptionId(invoice);
        Result<Tenant> tenantResult = await ResolveTenantAsync(invoice.CustomerId, subscriptionId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;

        SubscriptionHistory history = BuildSubscriptionHistory(
            tenant,
            new SubscriptionHistoryBuildRequest
            {
                EventType = "InvoiceSent",
                Amount = ConvertStripeAmount(invoice.AmountDue),
                Currency = NormalizeCurrency(invoice.Currency),
                StripeInvoiceId = invoice.Id,
                StripePaymentIntentId = null,
                ExternalTransactionId = invoice.Id,
                PaymentStatus = "Pending",
                StripeEventId = stripeEvent.Id,
                Notes = BuildNotes(new
                {
                    StripeEventId = stripeEvent.Id,
                    StripeEventType = stripeEvent.Type,
                    BillingReason = invoice.BillingReason
                })
            });

        await _repositorySet.SubscriptionHistoryRepository.AddAsync(history);

        _logger.LogInformation("HandleInvoiceSentAsync completed for tenant {TenantId}, invoice {InvoiceId}.", tenant.TenantId, invoice.Id);

        return Result.Ok();
    }

    private async Task<Result> HandleInvoiceUpcomingAsync(Event stripeEvent, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("HandleInvoiceUpcomingAsync started for event {EventId}.", stripeEvent.Id);

        Result<Invoice> invoiceResult = GetInvoiceFromEvent(stripeEvent);
        if (invoiceResult.IsFailed)
        {
            return Result.Fail(invoiceResult.Errors);
        }

        Invoice invoice = invoiceResult.Value;
        if (invoice.AmountDue <= 0)
        {
            _logger.LogDebug("Skipping promo-ending notification for invoice {InvoiceId} because amount due is zero.", invoice.Id);
            return Result.Ok();
        }

        string? subscriptionId = GetInvoiceSubscriptionId(invoice);
        Result<Tenant> tenantResult = await ResolveTenantAsync(invoice.CustomerId, subscriptionId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;
        bool shouldNotify = await ShouldNotifyPromoEndingAsync(tenant.TenantId, cancellationToken);
        if (!shouldNotify)
        {
            return Result.Ok();
        }

        decimal amountDue = ConvertStripeAmount(invoice.AmountDue) ?? 0m;
        DateTimeOffset chargeDate = ToDateTimeOffset(invoice.PeriodStart);

        _logger.LogInformation(
            "HandleInvoiceUpcomingAsync sending promo-ending notification for tenant {TenantId}, invoice {InvoiceId}, amountDue={AmountDue}.",
            tenant.TenantId,
            invoice.Id,
            amountDue);

        await NotifyPromoEndingAsync(tenant, chargeDate, amountDue, tenant.SubscriptionTier, cancellationToken);

        return Result.Ok();
    }

    private async Task<bool> ShouldNotifyPromoEndingAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        IReadOnlyList<SubscriptionHistory> history =
            await _repositorySet.SubscriptionHistoryRepository.GetByTenantIdAsync(tenantId, cancellationToken);

        bool hasPromoApplied = history.Any(record =>
            string.Equals(record.EventType, SubscriptionHistoryEventTypes.PromoApplied, StringComparison.OrdinalIgnoreCase));

        if (!hasPromoApplied)
        {
            return false;
        }

        bool hasPaidRenewal = history.Any(record =>
            string.Equals(record.EventType, SubscriptionHistoryEventTypes.Renewed, StringComparison.OrdinalIgnoreCase)
            && record.Amount.HasValue
            && record.Amount.Value > 0);

        return !hasPaidRenewal;
    }

    private async Task<Result> HandleTrialWillEndAsync(Event stripeEvent, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("HandleTrialWillEndAsync started for event {EventId}.", stripeEvent.Id);

        Result<Stripe.Subscription> subscriptionResult = GetSubscriptionFromEvent(stripeEvent);
        if (subscriptionResult.IsFailed)
        {
            return Result.Fail(subscriptionResult.Errors);
        }

        Stripe.Subscription subscription = subscriptionResult.Value;
        Result<Tenant> tenantResult = await ResolveTenantAsync(subscription.CustomerId, subscription.Id, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;

        DateTimeOffset? trialEnd = subscription.TrialEnd.HasValue
            ? ToDateTimeOffset(subscription.TrialEnd.Value)
            : (DateTimeOffset?)null;

        SubscriptionHistory history = BuildSubscriptionHistory(
            tenant,
            new SubscriptionHistoryBuildRequest
            {
                EventType = "TrialEnding",
                Amount = null,
                Currency = "USD",
                StripeInvoiceId = null,
                StripePaymentIntentId = null,
                ExternalTransactionId = subscription.Id,
                PaymentStatus = null,
                StripeEventId = stripeEvent.Id,
                Notes = BuildNotes(new
                {
                    StripeEventId = stripeEvent.Id,
                    StripeEventType = stripeEvent.Type,
                    TrialEnd = trialEnd?.ToString("o")
                })
            });

        await _repositorySet.SubscriptionHistoryRepository.AddAsync(history);

        _logger.LogInformation("HandleTrialWillEndAsync completed for tenant {TenantId}, subscription {SubscriptionId}, trialEnd={TrialEnd}.",
            tenant.TenantId, subscription.Id, trialEnd);

        await NotifyTrialEndingAsync(tenant, trialEnd, cancellationToken);

        return Result.Ok();
    }

    private async Task<Result> HandleCustomerUpdatedAsync(Event stripeEvent, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("HandleCustomerUpdatedAsync started for event {EventId}.", stripeEvent.Id);

        Result<Customer> customerResult = GetCustomerFromEvent(stripeEvent);
        if (customerResult.IsFailed)
        {
            return Result.Fail(customerResult.Errors);
        }

        Customer customer = customerResult.Value;

        if (string.IsNullOrWhiteSpace(customer.Id))
        {
            return Result.Fail(new BadRequestError("Stripe customer identifier is missing from webhook payload."));
        }

        Tenant? tenant = await _repositorySet.TenantRepository.GetByBillingCustomerIdAsync(customer.Id);
        if (tenant == null)
        {
            _logger.LogInformation("No tenant mapped to Stripe customer {CustomerId}; customer.updated will be ignored.", customer.Id);
            return Result.Ok();
        }

        if (!string.Equals(tenant.BillingCustomerId, customer.Id, StringComparison.Ordinal))
        {
            tenant.BillingCustomerId = customer.Id;
            await _repositorySet.TenantRepository.UpdateAsync(tenant);
        }

        _logger.LogInformation("HandleCustomerUpdatedAsync completed for tenant {TenantId}, customer {CustomerId}.", tenant.TenantId, customer.Id);

        return Result.Ok();
    }

    private async Task<Result<Tenant>> ResolveTenantAsync(string? customerId, string? subscriptionId, CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(subscriptionId))
        {
            cancellationToken.ThrowIfCancellationRequested();
            Tenant? tenantBySubscription = await _repositorySet.TenantRepository.GetByStripeSubscriptionIdAsync(subscriptionId);
            if (tenantBySubscription != null)
            {
                return Result.Ok(tenantBySubscription);
            }
        }

        if (!string.IsNullOrWhiteSpace(customerId))
        {
            cancellationToken.ThrowIfCancellationRequested();
            Tenant? tenantByCustomer = await _repositorySet.TenantRepository.GetByBillingCustomerIdAsync(customerId);
            if (tenantByCustomer != null)
            {
                return Result.Ok(tenantByCustomer);
            }
        }

        return Result.Fail<Tenant>(new NotFoundError("Unable to resolve tenant for Stripe webhook event."));
    }

    private async Task<Result> ReconcileSeatsWithStripeQuantityAsync(Guid tenantId, int targetQuantity, CancellationToken cancellationToken = default)
    {
        if (targetQuantity <= 0)
        {
            return Result.Fail(new BadRequestError("Stripe subscription quantity must be greater than zero."));
        }

        List<SubscriptionSeat> existingSeats = (await _repositorySet.SubscriptionSeatRepository.GetByTenantAsync(tenantId)).ToList();
        int currentCount = existingSeats.Count;

        if (targetQuantity == currentCount)
        {
            return Result.Ok();
        }

        if (targetQuantity > currentCount)
        {
            int seatsToAdd = targetQuantity - currentCount;
            DateTimeOffset now = DateTimeOffset.UtcNow;

            List<SubscriptionSeat> newSeats = new List<SubscriptionSeat>(seatsToAdd);
            for (int index = 0; index < seatsToAdd; index++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                SubscriptionSeat seat = new SubscriptionSeat
                {
                    TenantId = tenantId,
                    Status = ActiveSeatStatus,
                    IsBundled = false,
                    SeatStartDate = now,
                    CreatedOn = DateTime.UtcNow
                };

                newSeats.Add(seat);
            }

            await _repositorySet.SubscriptionSeatRepository.AddRangeAsync(newSeats);
            return Result.Ok();
        }

        int seatsToRemove = currentCount - targetQuantity;

        List<SubscriptionSeat> removableSeats = existingSeats
            .Where(seat => !seat.UserId.HasValue)
            .OrderBy(seat => seat.IsBundled)
            .ThenByDescending(seat => string.Equals(seat.Status, PendingCancellationSeatStatus, StringComparison.Ordinal))
            .ThenByDescending(seat => seat.SeatStartDate)
            .Take(seatsToRemove)
            .ToList();

        if (removableSeats.Count < seatsToRemove)
        {
            int occupiedSeatCount = existingSeats.Count(seat => seat.UserId.HasValue);
            return Result.Fail(new ConflictError(
                $"Cannot reconcile seat quantity to {targetQuantity}. Active occupied seats: {occupiedSeatCount}."));
        }

        DateTimeOffset canceledAt = DateTimeOffset.UtcNow;
        foreach (SubscriptionSeat seat in removableSeats)
        {
            cancellationToken.ThrowIfCancellationRequested();

            seat.Status = CanceledSeatStatus;
            seat.CanceledAt = canceledAt;
            seat.SeatEndDate = canceledAt;
            seat.UserId = null;
            seat.AssignedAt = null;
            await _repositorySet.SubscriptionSeatRepository.UpdateAsync(seat);
        }

        return Result.Ok();
    }

    private async Task<Result> CancelAllSeatsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        List<SubscriptionSeat> seats = (await _repositorySet.SubscriptionSeatRepository.GetByTenantAsync(tenantId)).ToList();
        DateTimeOffset now = DateTimeOffset.UtcNow;

        foreach (SubscriptionSeat seat in seats)
        {
            cancellationToken.ThrowIfCancellationRequested();

            seat.Status = CanceledSeatStatus;
            seat.CanceledAt ??= now;
            seat.SeatEndDate = now;
            seat.UserId = null;
            seat.AssignedAt = null;

            await _repositorySet.SubscriptionSeatRepository.UpdateAsync(seat);
        }

        return Result.Ok();
    }

    private void ApplyTierFromPrice(Tenant tenant, string? stripePriceId)
    {
        if (string.IsNullOrWhiteSpace(stripePriceId))
        {
            return;
        }

        Result<(Models.Billing.SubscriptionTier Tier, Models.Billing.BillingInterval Interval)> tierResult = _subscriptionTierService.GetTierFromPriceId(stripePriceId);
        if (tierResult.IsFailed)
        {
            return;
        }

        tenant.SubscriptionTier = tierResult.Value.Tier.ToString();
        tenant.BillingCycle = tierResult.Value.Interval.ToString();
    }

    /// <summary>
    /// Recomputes and applies the tenant's effective app/workspace limits from its tier,
    /// current subscription status, and the supplied seat count. Per-seat tiers scale their
    /// limits with the seat count; trialing tiers use trial limits. Failures are logged only.
    /// </summary>
    private void ApplyEffectiveLimitsToTenant(Tenant tenant, int seatCount)
    {
        Result<Models.Billing.EffectiveTierLimits> limitsResult = _subscriptionTierService.ResolveEffectiveLimits(
            tenant.SubscriptionTier, tenant.SubscriptionStatus, seatCount);

        if (limitsResult.IsFailed)
        {
            _logger.LogWarning(
                "Could not recompute effective limits for tenant {TenantId} (tier {Tier}, status {Status}, seats {SeatCount}): {Errors}",
                tenant.TenantId, tenant.SubscriptionTier, tenant.SubscriptionStatus, seatCount,
                string.Join("; ", limitsResult.Errors.Select(error => error.Message)));
            return;
        }

        tenant.MaxPublishedApps = limitsResult.Value.MaxPublishedApps;
        tenant.MaxWorkspaceConnections = limitsResult.Value.MaxWorkspaceConnections;
    }

    private async Task LogEventAsync(string eventId, string eventType, string payload, bool success, string? errorMessage, string? customerId, string? detailSummary)
    {
        StripeEventLog log = new StripeEventLog
        {
            StripeEventId = eventId,
            EventType = string.IsNullOrWhiteSpace(eventType) ? "unknown" : eventType,
            ProcessedAt = DateTime.UtcNow,
            Payload = payload,
            Success = success,
            ErrorMessage = Truncate(errorMessage, 2000),
            CustomerId = Truncate(customerId, 255),
            DetailSummary = Truncate(detailSummary, 500)
        };

        await _repositorySet.StripeEventLogRepository.AddAsync(log);
    }

    private async Task SafeLogEventAsync(Event stripeEvent, string payload, bool success, string? errorMessage)
    {
        try
        {
            string? customerId = ExtractCustomerId(stripeEvent);
            string? detailSummary = BuildDetailSummary(stripeEvent);

            await LogEventAsync(stripeEvent.Id, stripeEvent.Type, payload, success, errorMessage, customerId, detailSummary);
        }
        catch (Exception outerEx)
        {
            _logger.LogWarning(outerEx, "Failed to extract enrichment fields for Stripe event {EventId}; falling back to basic log.", stripeEvent.Id);

            try
            {
                await LogEventAsync(stripeEvent.Id, stripeEvent.Type, payload, success, errorMessage, null, null);
            }
            catch (Exception innerEx)
            {
                _logger.LogError(innerEx, "Failed to log Stripe event {EventId} even with fallback.", stripeEvent.Id);
            }
        }
    }

    private async Task NotifyPaymentFailedAsync(Tenant tenant, string? invoiceId, CancellationToken cancellationToken = default)
    {
        List<string> recipients = await ResolveBillingNotificationRecipientsAsync(tenant, "payment failed", cancellationToken);
        if (recipients.Count == 0)
        {
            return;
        }

        _logger.LogInformation(
            "Sending payment failed notification to {RecipientCount} recipient(s) for tenant {TenantId}.",
            recipients.Count,
            tenant.TenantId);

        foreach (string recipient in recipients)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                await _emailSenderService.SendBillingPaymentFailedAsync(recipient, tenant.DisplayName, invoiceId, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send payment failed notification to {Recipient} for tenant {TenantId}", recipient, tenant.TenantId);
            }
        }
    }

    private async Task NotifySubscriptionCanceledAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        List<string> recipients = await ResolveBillingNotificationRecipientsAsync(tenant, "subscription canceled", cancellationToken);
        if (recipients.Count == 0)
        {
            return;
        }

        _logger.LogInformation(
            "Sending subscription canceled notification to {RecipientCount} recipient(s) for tenant {TenantId}.",
            recipients.Count,
            tenant.TenantId);

        foreach (string recipient in recipients)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                await _emailSenderService.SendBillingSubscriptionCanceledAsync(recipient, tenant.DisplayName, tenant.SubscriptionEndDate, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send cancellation notification to {Recipient} for tenant {TenantId}", recipient, tenant.TenantId);
            }
        }
    }

    private async Task NotifyTrialEndingAsync(Tenant tenant, DateTimeOffset? trialEnd, CancellationToken cancellationToken = default)
    {
        List<string> recipients = await ResolveBillingNotificationRecipientsAsync(tenant, "trial ending", cancellationToken);
        if (recipients.Count == 0)
        {
            return;
        }

        _logger.LogInformation(
            "Sending trial ending notification to {RecipientCount} recipient(s) for tenant {TenantId}.",
            recipients.Count,
            tenant.TenantId);

        foreach (string recipient in recipients)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                await _emailSenderService.SendBillingTrialEndingAsync(recipient, tenant.DisplayName, trialEnd, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send trial ending notification to {Recipient} for tenant {TenantId}", recipient, tenant.TenantId);
            }
        }
    }

    private async Task NotifyPromoEndingAsync(
        Tenant tenant,
        DateTimeOffset? chargeDate,
        decimal estimatedAmount,
        string tier,
        CancellationToken cancellationToken = default)
    {
        List<string> recipients = await ResolveBillingNotificationRecipientsAsync(tenant, "promo ending", cancellationToken);
        if (recipients.Count == 0)
        {
            return;
        }

        _logger.LogInformation(
            "Sending promo ending notification to {RecipientCount} recipient(s) for tenant {TenantId}.",
            recipients.Count,
            tenant.TenantId);

        foreach (string recipient in recipients)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                await _emailSenderService.SendBillingPromoEndingAsync(
                    recipient,
                    tenant.DisplayName,
                    chargeDate,
                    estimatedAmount,
                    tier,
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send promo ending notification to {Recipient} for tenant {TenantId}", recipient, tenant.TenantId);
            }
        }
    }

    private async Task NotifySubscriptionRenewedAsync(Tenant tenant, int seatCount, CancellationToken cancellationToken = default)
    {
        List<string> recipients = await ResolveBillingNotificationRecipientsAsync(tenant, "subscription renewed", cancellationToken);
        if (recipients.Count == 0)
        {
            return;
        }

        _logger.LogInformation(
            "Sending subscription renewed notification to {RecipientCount} recipient(s) for tenant {TenantId}.",
            recipients.Count,
            tenant.TenantId);

        foreach (string recipient in recipients)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                await _emailSenderService.SendBillingSubscriptionRenewedAsync(recipient, tenant.DisplayName, tenant.SubscriptionEndDate, seatCount, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send renewal notification to {Recipient} for tenant {TenantId}", recipient, tenant.TenantId);
            }
        }
    }

    private async Task<List<string>> ResolveBillingNotificationRecipientsAsync(
        Tenant tenant,
        string notificationType,
        CancellationToken cancellationToken = default)
    {
        List<string> adminRecipients = await GetTenantAdminRecipientsAsync(tenant.TenantId, cancellationToken);
        if (adminRecipients.Count > 0)
        {
            return adminRecipients;
        }

        if (!string.IsNullOrWhiteSpace(tenant.InvoiceEmail))
        {
            _logger.LogInformation(
                "No tenant admin recipients for {NotificationType} notification on tenant {TenantId}; falling back to InvoiceEmail {InvoiceEmail}.",
                notificationType,
                tenant.TenantId,
                tenant.InvoiceEmail);

            return new List<string> { tenant.InvoiceEmail.Trim() };
        }

        _logger.LogWarning(
            "No billing notification recipients found for {NotificationType} on tenant {TenantId}. No active tenant admins with email notifications enabled and no InvoiceEmail configured.",
            notificationType,
            tenant.TenantId);

        return new List<string>();
    }

    private async Task<List<string>> GetTenantAdminRecipientsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        IEnumerable<UserTenantMembership> memberships = await _repositorySet.UserTenantMembershipRepository.GetByTenantIdAsync(tenantId, cancellationToken);

        return memberships
            .Where(membership => string.Equals(membership.Role, AuthRoles.TenantAdmin, StringComparison.OrdinalIgnoreCase))
            .Select(membership => membership.User)
            .Where(user => user != null
                && user.IsActive
                && user.EmailNotificationsEnabled
                && !string.IsNullOrWhiteSpace(user.Email))
            .Select(user => user!.Email!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string? ExtractCustomerId(Event stripeEvent)
    {
        string? customerId = stripeEvent.Data.Object switch
        {
            Stripe.Subscription subscription => subscription.CustomerId,
            Invoice invoice => invoice.CustomerId,
            Customer customer => customer.Id,
            PaymentMethod paymentMethod => paymentMethod.CustomerId,
            PaymentIntent paymentIntent => paymentIntent.CustomerId,
            Charge charge => charge.CustomerId,
            SetupIntent setupIntent => setupIntent.CustomerId,
            _ => null
        };

        if (!string.IsNullOrWhiteSpace(customerId))
        {
            return customerId;
        }

        return ExtractCustomerIdFromPreviousAttributes(stripeEvent);
    }

    private static string? ExtractCustomerIdFromPreviousAttributes(Event stripeEvent)
    {
        if (stripeEvent.Data.PreviousAttributes == null)
        {
            return null;
        }

        if (!stripeEvent.Data.PreviousAttributes.TryGetValue("customer", out object? value)
            || value == null)
        {
            return null;
        }

        string customerId = value!.ToString() ?? string.Empty;
        return string.IsNullOrWhiteSpace(customerId) ? null : customerId;
    }

    private static string? BuildDetailSummary(Event stripeEvent)
    {
        return stripeEvent.Type switch
        {
            EventTypes.CustomerSubscriptionCreated => BuildSubscriptionSummary("Subscription Created", stripeEvent),
            EventTypes.CustomerSubscriptionUpdated => BuildSubscriptionSummary("Subscription Updated", stripeEvent),
            EventTypes.CustomerSubscriptionPaused => BuildSubscriptionSummary("Subscription Paused", stripeEvent),
            EventTypes.CustomerSubscriptionResumed => BuildSubscriptionSummary("Subscription Resumed", stripeEvent),
            EventTypes.CustomerSubscriptionDeleted => "Subscription Canceled",
            EventTypes.InvoicePaid => BuildInvoiceSummary("Payment Successful", stripeEvent),
            EventTypes.InvoicePaymentFailed => BuildInvoiceSummary("Payment Failed", stripeEvent),
            EventTypes.InvoiceSent => BuildInvoiceSummary("Invoice Sent", stripeEvent),
            EventTypes.InvoiceUpcoming => BuildInvoiceSummary("Upcoming Invoice", stripeEvent),
            EventTypes.CustomerSubscriptionTrialWillEnd => BuildTrialEndingSummary(stripeEvent),
            EventTypes.CustomerUpdated => "Stripe Customer Profile Updated",
            "payment_method.attached" => BuildPaymentMethodSummary("Payment Method Saved", stripeEvent),
            "payment_method.detached" => BuildPaymentMethodSummary("Payment Method Removed", stripeEvent),
            "payment_method.updated" => BuildPaymentMethodSummary("Payment Method Updated", stripeEvent),
            _ => HumanizeEventType(stripeEvent.Type)
        };
    }

    private static string BuildSubscriptionSummary(string prefix, Event stripeEvent)
    {
        if (stripeEvent.Data.Object is not Stripe.Subscription subscription)
        {
            return prefix;
        }

        Stripe.SubscriptionItem? item = subscription.Items?.Data?.FirstOrDefault();
        string? planName = item?.Price?.Nickname ?? item?.Price?.Id;

        return string.IsNullOrWhiteSpace(planName)
            ? prefix
            : $"{prefix}: {planName}";
    }

    private static string BuildInvoiceSummary(string prefix, Event stripeEvent)
    {
        if (stripeEvent.Data.Object is not Invoice invoice)
        {
            return prefix;
        }

        long amount = prefix.Contains("Failed", StringComparison.Ordinal) ? invoice.AmountDue : invoice.AmountPaid;
        string currency = NormalizeCurrency(invoice.Currency);

        return $"{prefix}: {FormatStripeAmount(amount, currency)}";
    }

    private static string BuildTrialEndingSummary(Event stripeEvent)
    {
        if (stripeEvent.Data.Object is not Stripe.Subscription subscription || !subscription.TrialEnd.HasValue)
        {
            return "Trial Ending Soon";
        }

        return $"Trial Ending: {subscription.TrialEnd.Value:MMM d, yyyy}";
    }

    private static string BuildPaymentMethodSummary(string prefix, Event stripeEvent)
    {
        if (stripeEvent.Data.Object is not PaymentMethod paymentMethod || paymentMethod.Card == null)
        {
            return prefix;
        }

        string brand = string.IsNullOrWhiteSpace(paymentMethod.Card.Brand)
            ? "Card"
            : CapitalizeFirst(paymentMethod.Card.Brand);
        string last4 = paymentMethod.Card.Last4 ?? "****";

        return $"{prefix}: {brand} ******{last4}";
    }

    private static string HumanizeEventType(string? eventType)
    {
        if (string.IsNullOrWhiteSpace(eventType))
        {
            return "Unknown Event";
        }

        return eventType
            .Replace('.', ' ')
            .Replace('_', ' ');
    }

    private static string FormatStripeAmount(long amountInCents, string currency)
    {
        decimal amount = amountInCents / 100m;
        return $"{amount:C2} {currency}";
    }

    private static string CapitalizeFirst(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        return char.ToUpperInvariant(value[0]) + value.Substring(1).ToLowerInvariant();
    }

    private static Result<Stripe.Subscription> GetSubscriptionFromEvent(Event stripeEvent)
    {
        if (stripeEvent.Data.Object is Stripe.Subscription subscription)
        {
            return Result.Ok(subscription);
        }

        return Result.Fail<Stripe.Subscription>(new BadRequestError("Stripe webhook payload did not contain a subscription object."));
    }

    private static Result<Invoice> GetInvoiceFromEvent(Event stripeEvent)
    {
        if (stripeEvent.Data.Object is Invoice invoice)
        {
            return Result.Ok(invoice);
        }

        return Result.Fail<Invoice>(new BadRequestError("Stripe webhook payload did not contain an invoice object."));
    }

    private static Result<Customer> GetCustomerFromEvent(Event stripeEvent)
    {
        if (stripeEvent.Data.Object is Customer customer)
        {
            return Result.Ok(customer);
        }

        return Result.Fail<Customer>(new BadRequestError("Stripe webhook payload did not contain a customer object."));
    }

    private static int ToSubscriptionQuantity(long? quantity)
    {
        if (!quantity.HasValue)
        {
            return 1;
        }

        int parsedQuantity = Convert.ToInt32(quantity.Value);
        return Math.Max(parsedQuantity, 1);
    }

    private static decimal? ConvertStripeAmount(long? amountInCents)
    {
        if (!amountInCents.HasValue)
        {
            return null;
        }

        return amountInCents.Value / 100m;
    }

    private static string NormalizeCurrency(string? currency)
    {
        return string.IsNullOrWhiteSpace(currency) ? "USD" : currency.ToUpperInvariant();
    }

    private static string BuildNotes(object metadata)
    {
        string json = JsonSerializer.Serialize(metadata);
        return Truncate(json, 1000) ?? string.Empty;
    }

    private static string? GetInvoiceSubscriptionId(Invoice invoice)
    {
        return invoice.Parent?.SubscriptionDetails?.SubscriptionId;
    }

    private static string? GetInvoicePaymentIntentId(Invoice invoice)
    {
        InvoicePayment? defaultPayment = invoice.Payments?.Data?.FirstOrDefault(payment => payment.IsDefault);
        return defaultPayment?.Id;
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        if (value.Length <= maxLength)
        {
            return value;
        }

        return value.Substring(0, maxLength);
    }

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

    private static SubscriptionHistory BuildSubscriptionHistory(Tenant tenant, SubscriptionHistoryBuildRequest request)
    {
        return new SubscriptionHistory
        {
            TenantId = tenant.TenantId,
            EventType = request.EventType,
            SubscriptionTier = tenant.SubscriptionTier,
            BillingCycle = tenant.BillingCycle,
            Amount = request.Amount,
            Currency = NormalizeCurrency(request.Currency),
            StripeInvoiceId = request.StripeInvoiceId,
            StripePaymentIntentId = request.StripePaymentIntentId,
            ExternalTransactionId = request.ExternalTransactionId,
            PaymentStatus = request.PaymentStatus,
            StripeEventId = request.StripeEventId,
            EventDate = DateTime.UtcNow,
            Notes = Truncate(request.Notes, 1000)
        };
    }

    private sealed class SubscriptionHistoryBuildRequest
    {
        public required string EventType { get; init; }

        public decimal? Amount { get; init; }

        public required string Currency { get; init; }

        public string? StripeInvoiceId { get; init; }

        public string? StripePaymentIntentId { get; init; }

        public string? ExternalTransactionId { get; init; }

        public string? PaymentStatus { get; init; }

        public string? StripeEventId { get; init; }

        public string? Notes { get; init; }
    }
}
