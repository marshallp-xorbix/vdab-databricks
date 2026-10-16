using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Manages Stripe customer records and payment method operations for tenants.
/// </summary>
public interface IStripeCustomerService
{
    /// <summary>
    /// Creates a Stripe customer for the provided tenant and stores BillingCustomerId on the tenant.
    /// Uses <see cref="Tenant.InvoiceName"/> and <see cref="Tenant.InvoiceEmail"/> for Stripe customer details.
    /// </summary>
    /// <param name="tenant">The tenant to create a customer for.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The Stripe customer identifier.</returns>
    Task<Result<string>> CreateStripeCustomerAsync(Tenant tenant, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets an existing Stripe customer for the tenant or creates a new one if missing.
    /// Uses <see cref="Tenant.InvoiceName"/> and <see cref="Tenant.InvoiceEmail"/> for Stripe customer details.
    /// </summary>
    /// <param name="tenant">The tenant to resolve a Stripe customer for.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The Stripe customer identifier.</returns>
    Task<Result<string>> GetOrCreateStripeCustomerAsync(Tenant tenant, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates Stripe customer details from current tenant information.
    /// </summary>
    /// <param name="tenant">The tenant whose customer record should be updated.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> UpdateCustomerAsync(Tenant tenant, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a setup intent for adding a payment method on the frontend.
    /// </summary>
    /// <param name="customerId">The Stripe customer identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Setup intent client secret data.</returns>
    Task<Result<SetupIntentDto>> CreateSetupIntentAsync(string customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists card payment methods for a customer and marks the default payment method.
    /// </summary>
    /// <param name="customerId">The Stripe customer identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Customer payment methods.</returns>
    Task<Result<IList<PaymentMethodDto>>> ListPaymentMethodsAsync(string customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets the default payment method on a customer.
    /// </summary>
    /// <param name="customerId">The Stripe customer identifier.</param>
    /// <param name="paymentMethodId">The payment method identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> SetDefaultPaymentMethodAsync(string customerId, string paymentMethodId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Detaches (removes) a payment method from Stripe.
    /// </summary>
    /// <param name="paymentMethodId">The payment method identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> DetachPaymentMethodAsync(string paymentMethodId, CancellationToken cancellationToken = default);
}