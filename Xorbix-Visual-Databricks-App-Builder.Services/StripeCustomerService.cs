using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for Stripe customer and payment method operations.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="StripeCustomerService"/> class.
/// </remarks>
public class StripeCustomerService(
    ILogger<StripeCustomerService> _logger,
    IStripeClient _stripeClient,
    ITenantRepository _tenantRepository,
    UserManager<ApplicationUser> _userManager) : IStripeCustomerService
{
    /// <inheritdoc/>
    public async Task<Result<string>> CreateStripeCustomerAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(tenant);

        if (!string.IsNullOrWhiteSpace(tenant.BillingCustomerId))
        {
            return Result.Ok(tenant.BillingCustomerId);
        }

        try
        {
            string customerName = tenant.InvoiceName ?? tenant.DisplayName;
            string? customerEmail = tenant.InvoiceEmail;

            CustomerCreateOptions createOptions = new()
            {
                Name = customerName,
                Email = customerEmail,
                Description = $"VDAB tenant {tenant.TenantName}",
                Metadata = BuildCustomerMetadata(tenant)
            };

            // Deterministic idempotency key prevents Stripe from creating duplicate customers
            // for the same tenant even across multiple server instances.
            RequestOptions idempotencyOptions = new()
            {
                IdempotencyKey = $"create-customer-{tenant.TenantId}"
            };

            CustomerService customerService = new(_stripeClient);
            Customer customer = await customerService.CreateAsync(
                createOptions,
                requestOptions: idempotencyOptions,
                cancellationToken: cancellationToken);

            if (string.IsNullOrWhiteSpace(customer.Id))
            {
                return Result.Fail<string>(new BadRequestError("Stripe did not return a valid customer identifier."));
            }

            tenant.BillingCustomerId = customer.Id;

            if (tenant.TenantId != Guid.Empty)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await _tenantRepository.UpdateAsync(tenant, cancellationToken);
            }

            return Result.Ok(customer.Id);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Failed creating Stripe customer for tenant {TenantName}", tenant.TenantName);
            return Result.Fail<string>(BuildStripeError(ex, "Failed to create Stripe customer."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error creating Stripe customer for tenant {TenantName}", tenant.TenantName);
            return Result.Fail<string>("Failed to create Stripe customer.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<string>> GetOrCreateStripeCustomerAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(tenant);

        if (!string.IsNullOrWhiteSpace(tenant.BillingCustomerId))
        {
            _logger.LogDebug("GetOrCreateStripeCustomerAsync: tenant {TenantId} already has Stripe customer {CustomerId}; verifying.",
                tenant.TenantId, tenant.BillingCustomerId);

            try
            {
                CustomerService customerService = new CustomerService(_stripeClient);
                Customer customer = await customerService.GetAsync(
                    tenant.BillingCustomerId,
                    requestOptions: null,
                    cancellationToken: cancellationToken);

                if (!string.IsNullOrWhiteSpace(customer.Id))
                {
                    return Result.Ok(customer.Id);
                }
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex,
                    "Stripe customer {CustomerId} for tenant {TenantId} could not be loaded. A new customer will be created.",
                    tenant.BillingCustomerId,
                    tenant.TenantId);
            }
        }

        _logger.LogInformation("GetOrCreateStripeCustomerAsync: creating new Stripe customer for tenant {TenantId}.", tenant.TenantId);
        await EnsureBillingContactAsync(tenant);

        return await CreateStripeCustomerAsync(tenant, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<Result> UpdateCustomerAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(tenant);

        try
        {
            Result<string> customerResult = await GetOrCreateStripeCustomerAsync(tenant, cancellationToken: cancellationToken);
            if (customerResult.IsFailed)
            {
                return Result.Fail(customerResult.Errors);
            }

            string customerId = customerResult.Value;
            CustomerUpdateOptions updateOptions = new CustomerUpdateOptions
            {
                Name = tenant.InvoiceName ?? tenant.DisplayName,
                Email = tenant.InvoiceEmail,
                Description = $"VDAB tenant {tenant.TenantName}",
                Metadata = BuildCustomerMetadata(tenant)
            };

            CustomerService customerService = new CustomerService(_stripeClient);
            await customerService.UpdateAsync(
                customerId,
                updateOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            return Result.Ok();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Failed updating Stripe customer for tenant {TenantId}", tenant.TenantId);
            return Result.Fail(BuildStripeError(ex, "Failed to update Stripe customer."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error updating Stripe customer for tenant {TenantId}", tenant.TenantId);
            return Result.Fail("Failed to update Stripe customer.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SetupIntentDto>> CreateSetupIntentAsync(string customerId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return Result.Fail<SetupIntentDto>(new ValidationError("Stripe customer id is required."));
        }

        _logger.LogInformation("CreateSetupIntentAsync started for customer {CustomerId}.", customerId);

        try
        {
            SetupIntentCreateOptions createOptions = new SetupIntentCreateOptions
            {
                Customer = customerId,
                Usage = "off_session",
                AutomaticPaymentMethods = new SetupIntentAutomaticPaymentMethodsOptions
                {
                    Enabled = true
                }
                //PaymentMethodTypes = new List<string> { "card" } // Not needed when using automatic payment methods, but can be used to restrict to specific types if desired
            };

            SetupIntentService setupIntentService = new SetupIntentService(_stripeClient);
            SetupIntent setupIntent = await setupIntentService.CreateAsync(
                createOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            if (string.IsNullOrWhiteSpace(setupIntent.ClientSecret))
            {
                return Result.Fail<SetupIntentDto>(new BadRequestError("Stripe did not return a setup intent client secret."));
            }

            SetupIntentDto setupIntentDto = new SetupIntentDto
            {
                ClientSecret = setupIntent.ClientSecret
            };

            _logger.LogInformation("CreateSetupIntentAsync completed for customer {CustomerId}, setupIntentId={SetupIntentId}, status={Status}.",
                customerId, setupIntent.Id, setupIntent.Status);

            return Result.Ok(setupIntentDto);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Failed creating setup intent for customer {CustomerId}", customerId);
            return Result.Fail<SetupIntentDto>(BuildStripeError(ex, "Failed to create setup intent."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error creating setup intent for customer {CustomerId}", customerId);
            return Result.Fail<SetupIntentDto>("Failed to create setup intent.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IList<PaymentMethodDto>>> ListPaymentMethodsAsync(string customerId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return Result.Fail<IList<PaymentMethodDto>>(new ValidationError("Stripe customer id is required."));
        }

        _logger.LogDebug("ListPaymentMethodsAsync started for customer {CustomerId}.", customerId);

        try
        {
            CustomerService customerService = new CustomerService(_stripeClient);
            Customer customer = await customerService.GetAsync(
                customerId,
                requestOptions: null,
                cancellationToken: cancellationToken);
            string? defaultPaymentMethodId = customer.InvoiceSettings?.DefaultPaymentMethodId;

            PaymentMethodListOptions listOptions = new PaymentMethodListOptions
            {
                Customer = customerId,
                Type = "card"
            };

            PaymentMethodService paymentMethodService = new PaymentMethodService(_stripeClient);
            StripeList<PaymentMethod> stripePaymentMethods = await paymentMethodService.ListAsync(
                listOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            List<PaymentMethodDto> mappedPaymentMethods = stripePaymentMethods.Data
                .Where(pm => pm.Card != null && !string.IsNullOrWhiteSpace(pm.Id))
                .Select(pm => new PaymentMethodDto
                {
                    Id = pm.Id!,
                    Brand = string.IsNullOrWhiteSpace(pm.Card!.Brand) ? "unknown" : pm.Card.Brand,
                    Last4 = pm.Card.Last4 ?? string.Empty,
                    ExpMonth = (int)pm.Card.ExpMonth,
                    ExpYear = (int)pm.Card.ExpYear,
                    IsDefault = string.Equals(pm.Id, defaultPaymentMethodId, StringComparison.Ordinal)
                })
                .OrderByDescending(pm => pm.IsDefault)
                .ThenByDescending(pm => pm.ExpYear)
                .ThenByDescending(pm => pm.ExpMonth)
                .ToList();

            _logger.LogDebug("ListPaymentMethodsAsync completed for customer {CustomerId}: {Count} method(s), defaultPaymentMethodId={DefaultPaymentMethodId}.",
                customerId, mappedPaymentMethods.Count, defaultPaymentMethodId ?? "<none>");

            return Result.Ok<IList<PaymentMethodDto>>(mappedPaymentMethods);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Failed listing payment methods for customer {CustomerId}", customerId);
            return Result.Fail<IList<PaymentMethodDto>>(BuildStripeError(ex, "Failed to list payment methods."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error listing payment methods for customer {CustomerId}", customerId);
            return Result.Fail<IList<PaymentMethodDto>>("Failed to list payment methods.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> SetDefaultPaymentMethodAsync(string customerId, string paymentMethodId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return Result.Fail(new ValidationError("Stripe customer id is required."));
        }

        if (string.IsNullOrWhiteSpace(paymentMethodId))
        {
            return Result.Fail(new ValidationError("Stripe payment method id is required."));
        }

        try
        {
            CustomerUpdateOptions customerUpdateOptions = new CustomerUpdateOptions
            {
                InvoiceSettings = new CustomerInvoiceSettingsOptions
                {
                    DefaultPaymentMethod = paymentMethodId
                }
            };

            CustomerService customerService = new CustomerService(_stripeClient);
            await customerService.UpdateAsync(
                customerId,
                customerUpdateOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            SubscriptionListOptions subscriptionListOptions = new SubscriptionListOptions
            {
                Customer = customerId,
                Status = "all",
                Limit = 100
            };

            SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
            StripeList<Stripe.Subscription> subscriptions = await subscriptionService.ListAsync(
                subscriptionListOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            IEnumerable<Stripe.Subscription> activeSubscriptions = subscriptions.Data
                .Where(subscription => !string.Equals(subscription.Status, "canceled", StringComparison.OrdinalIgnoreCase));

            foreach (Stripe.Subscription subscription in activeSubscriptions)
            {
                cancellationToken.ThrowIfCancellationRequested();

                SubscriptionUpdateOptions subscriptionUpdateOptions = new SubscriptionUpdateOptions
                {
                    DefaultPaymentMethod = paymentMethodId
                };

                await subscriptionService.UpdateAsync(
                    subscription.Id,
                    subscriptionUpdateOptions,
                    requestOptions: null,
                    cancellationToken: cancellationToken);
            }

            _logger.LogInformation("SetDefaultPaymentMethodAsync completed for customer {CustomerId}, paymentMethodId={PaymentMethodId}.",
                customerId, paymentMethodId);

            return Result.Ok();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex,
                "Failed setting default payment method {PaymentMethodId} for customer {CustomerId}",
                paymentMethodId,
                customerId);

            return Result.Fail(BuildStripeError(ex, "Failed to set default payment method."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Unexpected error setting default payment method {PaymentMethodId} for customer {CustomerId}",
                paymentMethodId,
                customerId);

            return Result.Fail("Failed to set default payment method.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> DetachPaymentMethodAsync(string paymentMethodId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(paymentMethodId))
        {
            return Result.Fail(new ValidationError("Stripe payment method id is required."));
        }

        try
        {
            PaymentMethodService paymentMethodService = new PaymentMethodService(_stripeClient);
            PaymentMethodDetachOptions detachOptions = new PaymentMethodDetachOptions();

            await paymentMethodService.DetachAsync(
                paymentMethodId,
                detachOptions,
                requestOptions: null,
                cancellationToken: cancellationToken);

            return Result.Ok();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Failed detaching payment method {PaymentMethodId}", paymentMethodId);
            return Result.Fail(BuildStripeError(ex, "Failed to detach payment method."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error detaching payment method {PaymentMethodId}", paymentMethodId);
            return Result.Fail("Failed to detach payment method.");
        }
    }

    /// <summary>
    /// Populates <see cref="Tenant.InvoiceName"/> and <see cref="Tenant.InvoiceEmail"/> from the
    /// tenant owner when they are not already set.
    /// </summary>
    private async Task EnsureBillingContactAsync(Tenant tenant)
    {
        if (!string.IsNullOrWhiteSpace(tenant.InvoiceName) && !string.IsNullOrWhiteSpace(tenant.InvoiceEmail))
        {
            return;
        }

        bool isTeamOrEnterprise = string.Equals(tenant.SubscriptionTier, SubscriptionTierNames.Team, StringComparison.OrdinalIgnoreCase)
            || string.Equals(tenant.SubscriptionTier, SubscriptionTierNames.Enterprise, StringComparison.OrdinalIgnoreCase);

        if (isTeamOrEnterprise)
        {
            return;
        }

        Guid? ownerId = tenant.OwnerId ?? tenant.CreatedBy;
        if (!ownerId.HasValue || ownerId.Value == Guid.Empty)
        {
            return;
        }

        ApplicationUser? owner = await _userManager.FindByIdAsync(ownerId.Value.ToString());
        if (owner == null)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(tenant.InvoiceName))
        {
            string billingName = $"{owner.FirstName} {owner.LastName}".Trim();
            if (!string.IsNullOrWhiteSpace(billingName))
            {
                tenant.InvoiceName = billingName;
            }
        }

        if (string.IsNullOrWhiteSpace(tenant.InvoiceEmail) && !string.IsNullOrWhiteSpace(owner.Email))
        {
            tenant.InvoiceEmail = owner.Email;
        }
    }

    private static Dictionary<string, string> BuildCustomerMetadata(Tenant tenant)
    {
        Dictionary<string, string> metadata = new Dictionary<string, string>
        {
            ["tenantName"] = tenant.TenantName,
            ["displayName"] = tenant.DisplayName
        };

        if (tenant.TenantId != Guid.Empty)
        {
            metadata["tenantId"] = tenant.TenantId.ToString();
        }

        return metadata;
    }

    private static BadRequestError BuildStripeError(StripeException stripeException, string fallbackMessage)
    {
        string? stripeMessage = stripeException.StripeError?.Message;
        string safeMessage = string.IsNullOrWhiteSpace(stripeMessage) ? fallbackMessage : stripeMessage;

        return new BadRequestError(safeMessage);
    }
}