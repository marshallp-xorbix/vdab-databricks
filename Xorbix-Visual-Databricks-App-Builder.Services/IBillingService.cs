using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides tenant-scoped billing status, payment method, and invoice operations.
/// </summary>
public interface IBillingService
{
    /// <summary>
    /// Retrieves the customer details (invoice name and email) for a tenant.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Customer details DTO.</returns>
    Task<Result<CustomerDetailsDto>> GetCustomerDetailsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates the customer details (invoice name and email) for a tenant.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="request">Customer details to set.</param>
    /// <param name="updatedByUserId">The user performing the update.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated customer details DTO.</returns>
    Task<Result<CustomerDetailsDto>> UpdateCustomerDetailsAsync(Guid tenantId, CustomerDetailsDto request, Guid updatedByUserId, CancellationToken cancellationToken = default);
    /// <summary>
    /// Retrieves aggregated billing status for a tenant.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Billing status details.</returns>
    Task<Result<BillingStatusDto>> GetBillingStatusAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves the tenant's effective subscription view. Returns the Stripe-managed
    /// subscription when one exists; otherwise synthesizes a read-only plan from the
    /// tenant's provisioned tier (e.g., an administrator override) so manually created
    /// tenants without a Stripe customer still reflect their granted plan. Fails with a
    /// <c>NotFoundError</c> when the tenant has neither a Stripe subscription nor a usable tier.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The effective subscription details.</returns>
    Task<Result<SubscriptionDto>> GetEffectiveSubscriptionAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the Stripe publishable key configured for frontend Stripe.js usage.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Stripe publishable key.</returns>
    Task<Result<string>> GetPublishableKeyAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a Stripe setup intent for the tenant customer.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Setup intent client secret payload.</returns>
    Task<Result<SetupIntentDto>> CreateSetupIntentAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists saved payment methods for the tenant customer.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Saved payment methods.</returns>
    Task<Result<IList<PaymentMethodDto>>> GetPaymentMethodsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets the default payment method for the tenant customer.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="paymentMethodId">Stripe payment method identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> SetDefaultPaymentMethodAsync(Guid tenantId, string paymentMethodId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a payment method from the tenant customer.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="paymentMethodId">Stripe payment method identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> RemovePaymentMethodAsync(Guid tenantId, string paymentMethodId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists tenant invoices with pagination.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="skip">Number of invoices to skip.</param>
    /// <param name="take">Number of invoices to return.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Paginated invoice list.</returns>
    Task<Result<PaginatedInvoicesResponse>> GetInvoicesAsync(Guid tenantId, int skip, int take, CancellationToken cancellationToken = default);
}