using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Endpoints for managing tenant invitations (Phase 3 backend slice).
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="TenantInviteController"/> class.
/// </remarks>
[ApiController]
[Route("api/Tenant/invites")]
public class TenantInviteController(
    ILogger<TenantInviteController> _logger,
    ITenantInviteService _tenantInviteService) : AuthenticatedControllerBase
{
    /// <summary>
    /// Lists pending invites for the current tenant.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IList<TenantInviteDto>>> ListPending(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} listing invites for tenant {TenantId}", userId, tenantId);

        Result<IList<TenantInviteDto>> result = await _tenantInviteService.ListPendingAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Creates a batch of invites for the current tenant.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<CreateInvitesResponse>> CreateInvites(
        [FromBody] CreateInvitesRequest request,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} creating {Count} invite(s) for tenant {TenantId}",
            userId, request?.Emails?.Count ?? 0, tenantId);

        Result<CreateInvitesResponse> result = await _tenantInviteService.CreateInvitesAsync(
            tenantId, request?.Emails ?? [], userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Confirms a prior Detached member when invite create returned PriorMemberChoiceRequired.
    /// The invite UI confirms ReAdd (restore) only. DifferentPerson (retire + new invite) remains
    /// available on this API for a future support/admin path and is not offered in the invite dialog.
    /// </summary>
    [HttpPost("prior-member-choice")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PriorMemberChoiceResponse>> ConfirmPriorMemberChoice(
        [FromBody] PriorMemberChoiceRequest request,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {UserId} confirming prior-member choice {Choice} for {Email} in tenant {TenantId}",
            userId,
            request?.Choice,
            request?.Email,
            tenantId);

        Result<PriorMemberChoiceResponse> result = await _tenantInviteService.ConfirmPriorMemberChoiceAsync(
            tenantId,
            request?.Email ?? string.Empty,
            request?.Choice ?? PriorMemberChoice.ReAdd,
            userId,
            cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Cancels a pending invite.
    /// </summary>
    [HttpDelete("{inviteId:guid}")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    public async Task<IActionResult> CancelInvite(Guid inviteId, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} canceling invite {InviteId} for tenant {TenantId}", userId, inviteId, tenantId);

        Result result = await _tenantInviteService.CancelInviteAsync(tenantId, inviteId, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Re-issues a fresh token for a pending invite (email delivery is wired up in Phase 4).
    /// </summary>
    [HttpPost("{inviteId:guid}/resend")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantInviteDto>> ResendInvite(Guid inviteId, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} resending invite {InviteId} for tenant {TenantId}", userId, inviteId, tenantId);

        Result<TenantInviteDto> result = await _tenantInviteService.ResendInviteAsync(tenantId, inviteId, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Public endpoint that validates a raw invite token (used by the invite-landing page).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("validate")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<InviteValidationResponse>> Validate(
        [FromQuery] string token,
        CancellationToken cancellationToken = default)
    {
        Result<InviteValidationResponse> result = await _tenantInviteService.ValidateTokenAsync(token, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Accepts an invite for the authenticated user. The full seat-assignment flow
    /// is implemented in Phase 4.
    /// </summary>
    [HttpPost("accept")]
    [Authorize]
    public async Task<IActionResult> Accept(
        [FromBody] AcceptInviteRequest request,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result result = await _tenantInviteService.AcceptInviteAsync(request.Token, userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Anonymous endpoint that creates a brand-new user and accepts the invite in one call.
    /// Used when the invite link lands on a visitor with no existing account. In passwordless-only mode the
    /// response carries an <see cref="RegisterAndAcceptInviteResponse.AuthResponse"/> for immediate sign-in.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("register-and-accept")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<RegisterAndAcceptInviteResponse>> RegisterAndAccept(
        [FromBody] RegisterAndAcceptInviteRequest request,
        CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        string? userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        Result<RegisterAndAcceptInviteResponse> result =
            await _tenantInviteService.RegisterAndAcceptInviteAsync(request, ipAddress, userAgent, cancellationToken);
        return this.HandleFluentResult(result);
    }
}
