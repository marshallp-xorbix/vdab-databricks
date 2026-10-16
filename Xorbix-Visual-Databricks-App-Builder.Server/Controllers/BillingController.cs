using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Exposes tenant billing, subscription, seat, and invoice endpoints.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="BillingController"/> class.
/// </remarks>
[Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
[ApiController]
[Route("api/[controller]")]
public class BillingController(
    ILogger<BillingController> _logger,
    IBillingService _billingService,
    IStripeSubscriptionService _stripeSubscriptionService,
    IStripePromotionCodeService _stripePromotionCodeService,
    IBetaCodeService _betaCodeService,
    ISeatManagementService _seatManagementService,
    ISubscriptionHistoryService _subscriptionHistoryService,
    ISubscriptionTierService _subscriptionTierService) : AuthenticatedControllerBase
{

    /// <summary>
    /// Lists the available subscription plans with display pricing, limits, and trial terms.
    /// </summary>
    /// <remarks>
    /// Public, unauthenticated catalog read shared by the marketing pricing page and the
    /// authenticated checkout flow. Contains no tenant data or secrets.
    /// </remarks>
    /// <returns>The configured subscription plans.</returns>
    [AllowAnonymous]
    [HttpGet("plans")]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<IReadOnlyList<PlanDto>> GetPlans()
    {
        _logger.LogInformation("Retrieving subscription plan catalog");

        Result<IReadOnlyList<PlanDto>> result = _subscriptionTierService.GetPlans();
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets customer details (invoice name and email) for the current tenant.
    /// </summary>
    /// <returns>Customer details payload.</returns>
    [HttpGet("customer-details")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<CustomerDetailsDto>> GetCustomerDetails(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} requesting customer details for tenant {TenantId}", userId, tenantId);

        Result<CustomerDetailsDto> result = await _billingService.GetCustomerDetailsAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Updates customer details (invoice name and email) for the current tenant.
    /// </summary>
    /// <param name="request">Customer details to update.</param>
    /// <returns>Updated customer details.</returns>
    [HttpPut("customer-details")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<CustomerDetailsDto>> UpdateCustomerDetails([FromBody] CustomerDetailsDto request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} updating customer details for tenant {TenantId}", userId, tenantId);

        Result<CustomerDetailsDto> result = await _billingService.UpdateCustomerDetailsAsync(tenantId, request, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets full billing status for the current tenant.
    /// </summary>
    /// <returns>Billing status details.</returns>
    [HttpGet("status")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<BillingStatusDto>> GetStatus(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} requesting billing status for tenant {TenantId}", userId, tenantId);

        Result<BillingStatusDto> result = await _billingService.GetBillingStatusAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets configured Stripe publishable key.
    /// </summary>
    /// <returns>Stripe publishable key.</returns>
    [HttpGet("publishable-key")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<string>> GetPublishableKey(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} requesting Stripe publishable key for tenant {TenantId}", userId, tenantId);

        Result<string> result = await _billingService.GetPublishableKeyAsync(cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Creates a Stripe setup intent for adding a payment method.
    /// </summary>
    /// <returns>Setup intent client secret payload.</returns>
    [HttpPost("setup-intent")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SetupIntentDto>> CreateSetupIntent(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} creating setup intent for tenant {TenantId}", userId, tenantId);

        Result<SetupIntentDto> result = await _billingService.CreateSetupIntentAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Lists saved payment methods for the current tenant customer.
    /// </summary>
    /// <returns>Saved payment methods.</returns>
    [HttpGet("payment-methods")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IList<PaymentMethodDto>>> GetPaymentMethods(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} listing payment methods for tenant {TenantId}", userId, tenantId);

        Result<IList<PaymentMethodDto>> result = await _billingService.GetPaymentMethodsAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Sets the default payment method for the current tenant customer.
    /// </summary>
    /// <param name="id">Payment method identifier.</param>
    /// <returns>Success or failure.</returns>
    [HttpPost("payment-methods/{id}/default")]
    public async Task<IActionResult> SetDefaultPaymentMethod(string id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} setting default payment method {PaymentMethodId} for tenant {TenantId}",
            userId,
            id,
            tenantId);

        Result result = await _billingService.SetDefaultPaymentMethodAsync(tenantId, id, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Removes a saved payment method from the current tenant customer.
    /// </summary>
    /// <param name="id">Payment method identifier.</param>
    /// <returns>Success or failure.</returns>
    [HttpDelete("payment-methods/{id}")]
    public async Task<IActionResult> RemovePaymentMethod(string id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} removing payment method {PaymentMethodId} for tenant {TenantId}", userId, id, tenantId);

        Result result = await _billingService.RemovePaymentMethodAsync(tenantId, id, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets current subscription details for the tenant.
    /// </summary>
    /// <returns>Subscription details.</returns>
    [HttpGet("subscription")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SubscriptionDto>> GetSubscription(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} retrieving subscription for tenant {TenantId}", userId, tenantId);

        Result<SubscriptionDto> result = await _billingService.GetEffectiveSubscriptionAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Validates a promotion code for the selected plan before subscription signup.
    /// </summary>
    /// <param name="request">Promo code validation payload.</param>
    /// <returns>Validation preview when the code is eligible.</returns>
    [HttpPost("promo-codes/validate")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<PromoCodeValidationDto>> ValidatePromoCode(
        [FromBody] ValidatePromoCodeRequest request,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} validating promo code for tenant {TenantId}, tier {Tier}",
            userId,
            tenantId,
            request.Tier);

        Result<PromoCodeValidationDto> result = await _stripePromotionCodeService.ValidateAsync(
            tenantId,
            request.Code,
            request.Tier,
            request.BillingInterval,
            cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Validates a beta code before account creation. Applies code-level rules only; no tenant context required.
    /// </summary>
    /// <param name="request">Beta code preview validation payload.</param>
    /// <returns>Validation preview when the code is redeemable.</returns>
    [AllowAnonymous]
    [HttpPost("beta-codes/validate-preview")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(BetaCodeValidationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status410Gone)]
    public async Task<ActionResult<BetaCodeValidationDto>> ValidateBetaCodePreview(
        [FromBody] ValidateBetaCodePreviewRequest request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Anonymous beta code preview validation requested");

        Result<BetaCodeValidationDto> result = await _betaCodeService.ValidatePreviewAsync(
            request.Code,
            request.Tier,
            cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Validates a beta code for the current tenant before starting a no-card trial.
    /// </summary>
    /// <param name="request">Beta code validation payload.</param>
    /// <returns>Validation preview when the code is redeemable.</returns>
    [HttpPost("beta-codes/validate")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<BetaCodeValidationDto>> ValidateBetaCode(
        [FromBody] ValidateBetaCodeRequest request,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} validating beta code for tenant {TenantId}", userId, tenantId);

        Result<BetaCodeValidationDto> result = await _betaCodeService.ValidateAsync(tenantId, request.Code, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Redeems a beta code and creates a no-card trial subscription for the tenant.
    /// </summary>
    /// <param name="request">Beta code redemption payload.</param>
    /// <returns>Created subscription details (no payment confirmation secret).</returns>
    [HttpPost("subscription/beta")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SubscriptionDto>> CreateBetaSubscription(
        [FromBody] RedeemBetaCodeRequest request,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} redeeming beta code for tenant {TenantId}", userId, tenantId);

        Result<SubscriptionDto> result = await _betaCodeService.RedeemAndSubscribeAsync(tenantId, userId, request.Code, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Creates a new subscription for the tenant.
    /// </summary>
    /// <param name="request">Subscription request payload.</param>
    /// <returns>Created subscription details.</returns>
    [HttpPost("subscription")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SubscriptionDto>> CreateSubscription([FromBody] SubscriptionRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} creating subscription for tenant {TenantId} with tier {Tier}",
            userId,
            tenantId,
            request.Tier);

        Result<SubscriptionDto> result = await _stripeSubscriptionService.CreateSubscriptionAsync(
            tenantId,
            request.Tier,
            request.BillingInterval,
            request.PromoCode,
            request.StartTrial,
            cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Updates tenant subscription tier.
    /// </summary>
    /// <param name="request">Subscription request payload.</param>
    /// <returns>Updated subscription details.</returns>
    [HttpPut("subscription")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SubscriptionDto>> UpdateSubscription([FromBody] SubscriptionRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} updating subscription for tenant {TenantId} to tier {Tier}",
            userId,
            tenantId,
            request.Tier);

        Result<SubscriptionDto> result = await _stripeSubscriptionService.UpdateSubscriptionAsync(tenantId, request.Tier, request.BillingInterval, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Cancels tenant subscription immediately or at period end.
    /// </summary>
    /// <param name="immediate">True to cancel immediately; otherwise cancel at period end.</param>
    /// <returns>Updated subscription details.</returns>
    [HttpDelete("subscription")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SubscriptionDto>> CancelSubscription([FromQuery] bool immediate = false, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} canceling subscription for tenant {TenantId}. Immediate={Immediate}",
            userId,
            tenantId,
            immediate);

        Result<SubscriptionDto> result = await _stripeSubscriptionService.CancelSubscriptionAsync(tenantId, immediate, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Reactivates a subscription scheduled to cancel at period end.
    /// </summary>
    /// <returns>Updated subscription details.</returns>
    [HttpPost("subscription/reactivate")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SubscriptionDto>> ReactivateSubscription(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} reactivating subscription for tenant {TenantId}", userId, tenantId);

        Result<SubscriptionDto> result = await _stripeSubscriptionService.ReactivateSubscriptionAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Previews proration for a subscription tier change.
    /// </summary>
    /// <param name="newTier">Target subscription tier.</param>
    /// <returns>Upcoming invoice preview.</returns>
    [HttpGet("subscription/preview")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<InvoicePreviewDto>> PreviewSubscriptionChange([FromQuery] string newTier, [FromQuery] string? billingInterval, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} previewing subscription change for tenant {TenantId} to tier {Tier}",
            userId,
            tenantId,
            newTier);

        Result<InvoicePreviewDto> result = await _stripeSubscriptionService.GetUpcomingInvoiceAsync(tenantId, newTier, billingInterval, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Lists seats with occupant information for the current tenant.
    /// </summary>
    /// <returns>Seat list.</returns>
    [HttpGet("seats")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IList<SeatDto>>> GetSeats(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} listing seats for tenant {TenantId}", userId, tenantId);

        Result<IList<SeatDto>> result = await _seatManagementService.GetSeatsAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets seat summary counts for the current tenant.
    /// </summary>
    /// <returns>Seat summary.</returns>
    [HttpGet("seats/summary")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SeatSummaryDto>> GetSeatSummary(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} retrieving seat summary for tenant {TenantId}", userId, tenantId);

        Result<SeatSummaryDto> result = await _seatManagementService.GetSeatSummaryAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Purchases additional seats for the tenant subscription.
    /// </summary>
    /// <param name="request">Purchase seat request payload.</param>
    /// <returns>Created seat records with proration preview details.</returns>
    [HttpPost("seats/purchase")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<PurchaseSeatsResponseDto>> PurchaseSeats([FromBody] PurchaseSeatsRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} purchasing {Count} seats for tenant {TenantId}", userId, request.Count, tenantId);

        Result<SeatPreviewDto> previewResult = await _seatManagementService.PreviewSeatChangeAsync(tenantId, request.Count, cancellationToken);
        if (previewResult.IsFailed)
        {
            return this.HandleFluentResult(previewResult);
        }

        Result<IList<SeatDto>> purchaseResult = await _seatManagementService.PurchaseAdditionalSeatsAsync(tenantId, request.Count, cancellationToken);
        if (purchaseResult.IsFailed)
        {
            return this.HandleFluentResult(purchaseResult);
        }

        PurchaseSeatsResponseDto response = new PurchaseSeatsResponseDto
        {
            Seats = purchaseResult.Value,
            ProrationPreview = previewResult.Value
        };

        return this.HandleFluentResult(Result.Ok(response));
    }

    /// <summary>
    /// Schedules extra seats for cancellation at period end.
    /// </summary>
    /// <param name="request">Remove seats request payload.</param>
    /// <returns>Seats scheduled for cancellation.</returns>
    [HttpPost("seats/remove")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IList<SeatDto>>> RemoveSeats([FromBody] RemoveSeatsRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} removing {Count} seats for tenant {TenantId}", userId, request.Count, tenantId);

        Result<IList<SeatDto>> result = await _seatManagementService.RemoveExtraSeatsAsync(tenantId, request.Count, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Previews seat quantity proration.
    /// </summary>
    /// <param name="change">Seat delta to preview (positive or negative).</param>
    /// <returns>Seat change preview.</returns>
    [HttpGet("seats/preview")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SeatPreviewDto>> PreviewSeatChange([FromQuery] int change, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} previewing seat change {Delta} for tenant {TenantId}", userId, change, tenantId);

        Result<SeatPreviewDto> result = await _seatManagementService.PreviewSeatChangeAsync(tenantId, change, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Assigns a seat to a tenant user.
    /// </summary>
    /// <param name="seatId">Seat identifier.</param>
    /// <param name="request">Assign seat request payload.</param>
    /// <returns>Updated seat.</returns>
    [HttpPost("seats/{seatId:guid}/assign")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SeatDto>> AssignSeat(Guid seatId, [FromBody] AssignSeatRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} assigning seat {SeatId} to user {TargetUserId} for tenant {TenantId}", userId, seatId, request.UserId, tenantId);

        Result<SeatDto> result = await _seatManagementService.AssignSeatAsync(tenantId, seatId, request.UserId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Unassign a seat and optionally schedules extra seat cancellation.
    /// </summary>
    /// <param name="seatId">Seat identifier.</param>
    /// <param name="cancelSeat">When true, schedules extra seat cancellation at period end.</param>
    /// <returns>Updated seat.</returns>
    [HttpPost("seats/{seatId:guid}/unassign")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SeatDto>> UnassignSeat(Guid seatId, [FromQuery] bool cancelSeat = false, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} unassigning seat {SeatId} for tenant {TenantId}. CancelSeat={CancelSeat}",
            userId,
            seatId,
            tenantId,
            cancelSeat);

        Result<SeatDto> result = await _seatManagementService.UnassignSeatAsync(tenantId, seatId, cancelSeat, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Transfers seat assignment to another user.
    /// </summary>
    /// <param name="seatId">Seat identifier.</param>
    /// <param name="request">Transfer seat request payload.</param>
    /// <returns>Updated seat.</returns>
    [HttpPost("seats/{seatId:guid}/transfer")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SeatDto>> TransferSeat(Guid seatId, [FromBody] TransferSeatRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} transferring seat {SeatId} to user {TargetUserId} for tenant {TenantId}",
            userId,
            seatId,
            request.NewUserId,
            tenantId);

        Result<SeatDto> result = await _seatManagementService.TransferSeatAsync(tenantId, seatId, request.NewUserId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Removes the assigned user from a seat. The seat remains Active and becomes available for assignment.
    /// If the seat's user is native to this tenant, the user is soft-deactivated.
    /// </summary>
    /// <param name="seatId">Seat identifier.</param>
    /// <returns>Updated seat.</returns>
    [HttpPost("seats/{seatId:guid}/remove-user")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SeatDto>> RemoveUserFromSeat(Guid seatId, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} removing seat occupant for seat {SeatId} in tenant {TenantId}",
            userId,
            seatId,
            tenantId);

        Result<SeatDto> result = await _seatManagementService.RemoveUserFromSeatAsync(tenantId, seatId, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Schedules a seat for cancellation at the end of the current billing period.
    /// Bundled seats cannot be removed directly; reduce the plan minimum instead.
    /// The assigned user retains access until the period ends.
    /// </summary>
    /// <param name="seatId">Seat identifier.</param>
    /// <returns>Updated seat in PendingCancellation status.</returns>
    [HttpPost("seats/{seatId:guid}/remove-seat")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<SeatDto>> RemoveSeat(Guid seatId, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} scheduling seat cancellation for seat {SeatId} in tenant {TenantId}",
            userId,
            seatId,
            tenantId);

        Result<SeatDto> result = await _seatManagementService.RemoveSeatAndUserAsync(tenantId, seatId, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Lists tenant invoices with pagination.
    /// </summary>
    /// <param name="skip">Number of invoices to skip.</param>
    /// <param name="take">Number of invoices to return.</param>
    /// <returns>Paginated invoice list.</returns>
    [HttpGet("invoices")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<PaginatedInvoicesResponse>> GetInvoices([FromQuery] int skip = 0, [FromQuery] int take = 25, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} retrieving invoices for tenant {TenantId} (skip={Skip}, take={Take})",
            userId,
            tenantId,
            skip,
            take);

        Result<PaginatedInvoicesResponse> result = await _billingService.GetInvoicesAsync(tenantId, skip, take, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Lists seats with occupant information for a specific tenant. Requires Global Administrator role.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <returns>Seat list for the specified tenant.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet("tenants/{tenantId:guid}/seats")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IList<SeatDto>>> GetSeatsForTenant(Guid tenantId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Administrator retrieving seats for tenant {TenantId}", tenantId);

        Result<IList<SeatDto>> result = await _seatManagementService.GetSeatsAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Lists subscription history for a specific tenant. Requires Global Administrator role.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <returns>The tenant's subscription history records ordered by event date descending.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet("tenants/{tenantId:guid}/subscription-history")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IReadOnlyList<SubscriptionHistoryDto>>> GetSubscriptionHistoryForTenant(Guid tenantId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Administrator retrieving subscription history for tenant {TenantId}", tenantId);

        Result<IReadOnlyList<SubscriptionHistoryDto>> result = await _subscriptionHistoryService.GetSubscriptionHistoryAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }
    /// <summary>
    /// Lists invoices for a specific tenant. Requires Global Administrator role.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="skip">Number of invoices to skip.</param>
    /// <param name="take">Number of invoices to return.</param>
    /// <returns>Paginated invoice list for the tenant.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet("tenants/{tenantId:guid}/invoices")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<PaginatedInvoicesResponse>> GetInvoicesForTenant(Guid tenantId, [FromQuery] int skip = 0, [FromQuery] int take = 25, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "Administrator retrieving invoices for tenant {TenantId} (skip={Skip}, take={Take})",
            tenantId,
            skip,
            take);

        Result<PaginatedInvoicesResponse> result = await _billingService.GetInvoicesAsync(tenantId, skip, take, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets upcoming invoice preview for current subscription.
    /// </summary>
    /// <returns>Upcoming invoice preview.</returns>
    [HttpGet("invoices/upcoming")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<InvoicePreviewDto>> GetUpcomingInvoice(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} retrieving upcoming invoice for tenant {TenantId}", userId, tenantId);

        Result<InvoicePreviewDto> result = await _stripeSubscriptionService.GetUpcomingInvoiceAsync(tenantId, null, null, cancellationToken);
        return this.HandleFluentResult(result);
    }
}