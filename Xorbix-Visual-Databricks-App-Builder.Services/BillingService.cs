using FluentResults;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides aggregated billing operations for a tenant.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="BillingService"/> class.
/// </remarks>
public class BillingService(
    ILogger<BillingService> _logger,
    ITenantService _tenantService,
    IStripeCustomerService _stripeCustomerService,
    IStripeSubscriptionService _stripeSubscriptionService,
    IInternalDevTenantService _internalDevTenantService,
    IStripeClient _stripeClient,
    IOptions<StripeSettings> _stripeSettingsOptions) : IBillingService
{
    private const int MaxInvoicePageSize = 100;

    /// <inheritdoc/>
    public async Task<Result<BillingStatusDto>> GetBillingStatusAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<BillingStatusDto>(tenantResult.Errors);
            }

            cancellationToken.ThrowIfCancellationRequested();

            Tenant tenant = tenantResult.Value;

            Result<string> customerIdResult = await _stripeCustomerService.GetOrCreateStripeCustomerAsync(tenant, cancellationToken: cancellationToken);
            if (customerIdResult.IsFailed)
            {
                return Result.Fail<BillingStatusDto>(customerIdResult.Errors);
            }

            cancellationToken.ThrowIfCancellationRequested();

            Result<IList<PaymentMethodDto>> paymentMethodsResult =
                await _stripeCustomerService.ListPaymentMethodsAsync(customerIdResult.Value, cancellationToken: cancellationToken);

            if (paymentMethodsResult.IsFailed)
            {
                return Result.Fail<BillingStatusDto>(paymentMethodsResult.Errors);
            }

            SubscriptionDto? subscription = null;
            SeatSummaryDto? seatSummary = null;

            if (!string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId))
            {
                cancellationToken.ThrowIfCancellationRequested();

                Result<SubscriptionDto> subscriptionResult = await _stripeSubscriptionService.GetSubscriptionAsync(tenantId, cancellationToken);
                if (subscriptionResult.IsSuccess)
                {
                    subscription = subscriptionResult.Value;
                    seatSummary = subscription.SeatSummary;
                }
                else if (!subscriptionResult.HasError<NotFoundError>())
                {
                    return Result.Fail<BillingStatusDto>(subscriptionResult.Errors);
                }
            }

            string? defaultPaymentMethodId = paymentMethodsResult.Value
                .FirstOrDefault(method => method.IsDefault)
                ?.Id;

            BillingStatusDto statusDto = new BillingStatusDto
            {
                HasSubscription = subscription != null && IsActiveOrTrialingStatus(subscription.Status),
                Subscription = subscription,
                SeatSummary = seatSummary,
                PaymentMethods = paymentMethodsResult.Value,
                DefaultPaymentMethodId = defaultPaymentMethodId
            };

            return Result.Ok(statusDto);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve billing status for tenant {TenantId}", tenantId);
            return Result.Fail<BillingStatusDto>("Failed to retrieve billing status.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SubscriptionDto>> GetEffectiveSubscriptionAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SubscriptionDto>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;

            // A tenant with a Stripe subscription is fully billing-managed; defer to Stripe.
            if (!string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId))
            {
                return await _stripeSubscriptionService.GetSubscriptionAsync(tenantId, cancellationToken);
            }

            // Manually provisioned tenants (e.g., an administrator tier override) have a
            // plan but no Stripe customer. Synthesize a read-only subscription view from
            // tenant state so the account experience reflects the granted tier while
            // billing and invoice features remain disabled.
            //
            // The status gate is the differentiator between a granted plan and a
            // self-registration that never completed payment: self-signup tenants are
            // created with status "incomplete" and only move to active/trialing once
            // Stripe confirms payment. An incomplete tenant therefore has no usable plan
            // and falls through to NotFound ("Not subscribed").
            if (!HasUsableTier(tenant.SubscriptionTier) || !IsActiveOrTrialingStatus(tenant.SubscriptionStatus))
            {
                return Result.Fail<SubscriptionDto>(new NotFoundError("Tenant does not have an active subscription."));
            }

            SubscriptionDto synthesized = new SubscriptionDto
            {
                Id = string.Empty,
                Tier = tenant.SubscriptionTier,
                Status = tenant.SubscriptionStatus,
                CurrentPeriodStart = tenant.SubscriptionStartDate?.UtcDateTime ?? default,
                CurrentPeriodEnd = tenant.SubscriptionEndDate?.UtcDateTime ?? default,
                CancelAtPeriodEnd = false,
                HasStripeCustomer = !string.IsNullOrWhiteSpace(tenant.BillingCustomerId),
                AllowsComplimentarySeatManagement = _internalDevTenantService.IsInternalDevTenant(tenantId)
            };

            return Result.Ok(synthesized);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve effective subscription for tenant {TenantId}", tenantId);
            return Result.Fail<SubscriptionDto>("Failed to retrieve subscription.");
        }
    }

    private static bool HasUsableTier(string? tier)
    {
        return !string.IsNullOrWhiteSpace(tier)
            && !string.Equals(tier, nameof(SubscriptionTier.None), StringComparison.OrdinalIgnoreCase);
    }

    /// <inheritdoc/>
    public Task<Result<string>> GetPublishableKeyAsync(CancellationToken cancellationToken = default)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return Task.FromCanceled<Result<string>>(cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(_stripeSettingsOptions.Value.PublishableKey))
        {
            return Task.FromResult(Result.Fail<string>(new BadRequestError("Stripe publishable key is not configured.")));
        }

        return Task.FromResult(Result.Ok(_stripeSettingsOptions.Value.PublishableKey));
    }

    /// <inheritdoc/>
    public async Task<Result<SetupIntentDto>> CreateSetupIntentAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Result<string> customerIdResult = await GetOrCreateCustomerIdAsync(tenantId, cancellationToken);
        if (customerIdResult.IsFailed)
        {
            return Result.Fail<SetupIntentDto>(customerIdResult.Errors);
        }

        cancellationToken.ThrowIfCancellationRequested();

        return await _stripeCustomerService.CreateSetupIntentAsync(customerIdResult.Value, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<Result<IList<PaymentMethodDto>>> GetPaymentMethodsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Result<string> customerIdResult = await GetOrCreateCustomerIdAsync(tenantId, cancellationToken);
        if (customerIdResult.IsFailed)
        {
            return Result.Fail<IList<PaymentMethodDto>>(customerIdResult.Errors);
        }

        cancellationToken.ThrowIfCancellationRequested();

        return await _stripeCustomerService.ListPaymentMethodsAsync(customerIdResult.Value, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<Result> SetDefaultPaymentMethodAsync(Guid tenantId, string paymentMethodId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(paymentMethodId))
        {
            return Result.Fail(new ValidationError("Payment method id is required."));
        }

        Result<string> customerIdResult = await GetOrCreateCustomerIdAsync(tenantId, cancellationToken);
        if (customerIdResult.IsFailed)
        {
            return Result.Fail(customerIdResult.Errors);
        }

        cancellationToken.ThrowIfCancellationRequested();

        string customerId = customerIdResult.Value;
        Result<IList<PaymentMethodDto>> paymentMethodsResult = await _stripeCustomerService.ListPaymentMethodsAsync(customerId, cancellationToken);
        if (paymentMethodsResult.IsFailed)
        {
            return Result.Fail(paymentMethodsResult.Errors);
        }

        bool paymentMethodExists = paymentMethodsResult.Value.Any(method =>
            string.Equals(method.Id, paymentMethodId, StringComparison.Ordinal));

        if (!paymentMethodExists)
        {
            return Result.Fail(new NotFoundError("Payment method was not found for the tenant customer."));
        }

        cancellationToken.ThrowIfCancellationRequested();

        return await _stripeCustomerService.SetDefaultPaymentMethodAsync(customerId, paymentMethodId, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<Result> RemovePaymentMethodAsync(Guid tenantId, string paymentMethodId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(paymentMethodId))
        {
            return Result.Fail(new ValidationError("Payment method id is required."));
        }

        Result<string> customerIdResult = await GetOrCreateCustomerIdAsync(tenantId, cancellationToken);
        if (customerIdResult.IsFailed)
        {
            return Result.Fail(customerIdResult.Errors);
        }

        cancellationToken.ThrowIfCancellationRequested();

        Result<IList<PaymentMethodDto>> paymentMethodsResult =
            await _stripeCustomerService.ListPaymentMethodsAsync(customerIdResult.Value, cancellationToken);

        if (paymentMethodsResult.IsFailed)
        {
            return Result.Fail(paymentMethodsResult.Errors);
        }

        bool paymentMethodExists = paymentMethodsResult.Value.Any(method =>
            string.Equals(method.Id, paymentMethodId, StringComparison.Ordinal));

        if (!paymentMethodExists)
        {
            return Result.Fail(new NotFoundError("Payment method was not found for the tenant customer."));
        }

        cancellationToken.ThrowIfCancellationRequested();

        return await _stripeCustomerService.DetachPaymentMethodAsync(paymentMethodId, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<Result<PaginatedInvoicesResponse>> GetInvoicesAsync(Guid tenantId, int skip, int take, CancellationToken cancellationToken = default)
    {
        Result validationResult = ValidatePaginationArguments(skip, take);
        if (validationResult.IsFailed)
        {
            return Result.Fail<PaginatedInvoicesResponse>(validationResult.Errors);
        }

        try
        {
            Result<Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<PaginatedInvoicesResponse>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;

            if (string.IsNullOrWhiteSpace(tenant.BillingCustomerId))
            {
                PaginatedInvoicesResponse emptyResponse = new PaginatedInvoicesResponse
                {
                    Invoices = Array.Empty<InvoiceDto>(),
                    Skip = skip,
                    Take = take,
                    HasMore = false
                };

                return Result.Ok(emptyResponse);
            }

            InvoiceService invoiceService = new InvoiceService(_stripeClient);
            Result<(string? StartingAfter, bool ReachedEnd)> cursorResult =
                await ResolveStartingAfterAsync(invoiceService, tenant.BillingCustomerId, skip, cancellationToken);

            if (cursorResult.IsFailed)
            {
                return Result.Fail<PaginatedInvoicesResponse>(cursorResult.Errors);
            }

            if (cursorResult.Value.ReachedEnd)
            {
                PaginatedInvoicesResponse emptyPagedResponse = new PaginatedInvoicesResponse
                {
                    Invoices = Array.Empty<InvoiceDto>(),
                    Skip = skip,
                    Take = take,
                    HasMore = false
                };

                return Result.Ok(emptyPagedResponse);
            }

            InvoiceListOptions pageOptions = new InvoiceListOptions
            {
                Customer = tenant.BillingCustomerId,
                Limit = take,
                StartingAfter = cursorResult.Value.StartingAfter
            };

            cancellationToken.ThrowIfCancellationRequested();

            StripeList<Invoice> page = await invoiceService.ListAsync(
                pageOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            List<InvoiceDto> invoices = page.Data
                .Where(invoice => !string.Equals(invoice.Status, "draft", StringComparison.OrdinalIgnoreCase))
                .Where(invoice => !string.IsNullOrWhiteSpace(invoice.Id))
                .Select(MapInvoice)
                .ToList();

            PaginatedInvoicesResponse response = new PaginatedInvoicesResponse
            {
                Invoices = invoices,
                Skip = skip,
                Take = take,
                HasMore = page.HasMore
            };

            return Result.Ok(response);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe invoice retrieval failed for tenant {TenantId}", tenantId);
            return Result.Fail<PaginatedInvoicesResponse>(BuildStripeError(ex, "Failed to retrieve invoices."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve invoices for tenant {TenantId}", tenantId);
            return Result.Fail<PaginatedInvoicesResponse>("Failed to retrieve invoices.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<CustomerDetailsDto>> GetCustomerDetailsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Result<Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail<CustomerDetailsDto>(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;
        CustomerDetailsDto dto = new CustomerDetailsDto
        {
            InvoiceName = tenant.InvoiceName ?? tenant.DisplayName,
            InvoiceEmail = tenant.InvoiceEmail ?? string.Empty
        };

        return Result.Ok(dto);
    }

    /// <inheritdoc/>
    public async Task<Result<CustomerDetailsDto>> UpdateCustomerDetailsAsync(Guid tenantId, CustomerDetailsDto request, Guid updatedByUserId, CancellationToken cancellationToken = default)
    {
        Result<Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail<CustomerDetailsDto>(tenantResult.Errors);
        }

        Tenant tenant = tenantResult.Value;

        UpdateTenantRequest updateRequest = new UpdateTenantRequest
        {
            DisplayName = tenant.DisplayName,
            InvoiceName = request.InvoiceName,
            InvoiceEmail = request.InvoiceEmail
        };

        Result<Tenant> updateResult = await _tenantService.UpdateTenantAsync(tenantId, updateRequest, updatedByUserId, tenant, cancellationToken);
        if (updateResult.IsFailed)
        {
            return Result.Fail<CustomerDetailsDto>(updateResult.Errors);
        }

        Tenant updated = updateResult.Value;
        CustomerDetailsDto dto = new CustomerDetailsDto
        {
            InvoiceName = updated.InvoiceName ?? updated.DisplayName,
            InvoiceEmail = updated.InvoiceEmail ?? string.Empty
        };

        return Result.Ok(dto);
    }

    private async Task<Result<string>> GetOrCreateCustomerIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Result<Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail<string>(tenantResult.Errors);
        }

        cancellationToken.ThrowIfCancellationRequested();

        return await _stripeCustomerService.GetOrCreateStripeCustomerAsync(tenantResult.Value, cancellationToken: cancellationToken);
    }

    private static bool IsActiveOrTrialingStatus(string status)
    {
        return string.Equals(status, "active", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "trialing", StringComparison.OrdinalIgnoreCase);
    }

    private static Result ValidatePaginationArguments(int skip, int take)
    {
        if (skip < 0)
        {
            return Result.Fail(new ValidationError("Skip must be greater than or equal to zero."));
        }

        if (take <= 0 || take > MaxInvoicePageSize)
        {
            return Result.Fail(new ValidationError($"Take must be between 1 and {MaxInvoicePageSize}."));
        }

        return Result.Ok();
    }

    private static async Task<Result<(string? StartingAfter, bool ReachedEnd)>> ResolveStartingAfterAsync(
        InvoiceService invoiceService,
        string customerId,
        int skip,
        CancellationToken cancellationToken = default)
    {
        string? startingAfter = null;
        int remainingSkip = skip;

        while (remainingSkip > 0)
        {
            cancellationToken.ThrowIfCancellationRequested();

            int batchSize = Math.Min(remainingSkip, MaxInvoicePageSize);

            InvoiceListOptions skipOptions = new InvoiceListOptions
            {
                Customer = customerId,
                Limit = batchSize,
                StartingAfter = startingAfter
            };

            StripeList<Invoice> skipPage = await invoiceService.ListAsync(
                skipOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);
            if (skipPage.Data.Count == 0)
            {
                return Result.Ok<(string? StartingAfter, bool ReachedEnd)>((StartingAfter: startingAfter, ReachedEnd: true));
            }

            Invoice lastInvoice = skipPage.Data[skipPage.Data.Count - 1];
            if (string.IsNullOrWhiteSpace(lastInvoice.Id))
            {
                return Result.Fail<(string? StartingAfter, bool ReachedEnd)>(
                    new BadRequestError("Stripe invoice pagination cursor could not be resolved."));
            }

            startingAfter = lastInvoice.Id;
            remainingSkip -= skipPage.Data.Count;

            if (!skipPage.HasMore && remainingSkip > 0)
            {
                return Result.Ok<(string? StartingAfter, bool ReachedEnd)>((StartingAfter: startingAfter, ReachedEnd: true));
            }
        }

        return Result.Ok<(string? StartingAfter, bool ReachedEnd)>((StartingAfter: startingAfter, ReachedEnd: false));
    }

    private static InvoiceDto MapInvoice(Invoice invoice)
    {
        DateTime createdUtc = invoice.Created.Kind == DateTimeKind.Utc
            ? invoice.Created
            : invoice.Created.ToUniversalTime();

        return new InvoiceDto
        {
            Id = invoice.Id!,
            Amount = invoice.Total / 100m,
            Currency = NormalizeCurrency(invoice.Currency),
            Status = string.IsNullOrWhiteSpace(invoice.Status) ? "unknown" : invoice.Status,
            Created = createdUtc,
            PdfUrl = invoice.InvoicePdf,
            HostedInvoiceUrl = invoice.HostedInvoiceUrl
        };
    }

    private static string NormalizeCurrency(string? currency)
    {
        return string.IsNullOrWhiteSpace(currency)
            ? "USD"
            : currency.ToUpperInvariant();
    }

    private static BadRequestError BuildStripeError(StripeException stripeException, string fallbackMessage)
    {
        string? stripeMessage = stripeException.StripeError?.Message;
        string safeMessage = string.IsNullOrWhiteSpace(stripeMessage) ? fallbackMessage : stripeMessage;

        return new BadRequestError(safeMessage);
    }
}