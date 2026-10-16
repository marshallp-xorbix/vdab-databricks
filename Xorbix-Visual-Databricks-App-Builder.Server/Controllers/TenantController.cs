using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Server.Middleware;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Controller for tenant membership, context management, and tenant entity operations.
/// Handles tenant switching, listing user tenants, setting default tenant,
/// and CRUD operations on tenant entities.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="TenantController"/> class.
/// </remarks>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TenantController(
    IAuthService _authService,
    IUserTenantMembershipService _userTenantMembershipService,
    ITenantService _tenantService,
    ITenantLifecycleService _tenantLifecycleService,
    ISeatManagementService _seatManagementService,
    IStripeSubscriptionService _stripeSubscriptionService,
    IUserProvisioningService _userProvisioningService,
    IPersonalWorkspaceService _personalWorkspaceService,
    ILogger<TenantController> _logger) : AuthenticatedControllerBase
{
#pragma warning disable CA1873 // Avoid potentially expensive logging

    /// <summary>
    /// Lists all tenant memberships for the authenticated user.
    /// Returns lightweight data for populating the tenant switcher dropdown.
    /// </summary>
    /// <returns>A list of <see cref="TenantMembershipDto"/> representing the user's tenant memberships.</returns>
    [HttpGet("my-tenants")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IEnumerable<TenantMembershipDto>>> GetMyTenants(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} requesting tenant memberships", userId);

        Result<IEnumerable<TenantMembershipDto>> result = await _userTenantMembershipService.GetUserTenantMembershipDtosAsync(userId, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Creates a personal Incomplete workspace for the authenticated user when they have no
    /// live memberships (Detached). Self-only; does not clear account tombstones or write TenantId.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The created <see cref="TenantDto"/>.</returns>
    [HttpPost("personal-workspace")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(TenantDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TenantDto>> CreatePersonalWorkspace(
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} requesting personal workspace creation", userId);

        Result<TenantDto> result = await _personalWorkspaceService.CreatePersonalWorkspaceAsync(
            userId,
            cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Switches the authenticated user's active tenant context.
    /// Returns a full <see cref="AuthResponse"/> with new JWT tokens containing updated tenant claims.
    /// </summary>
    /// <param name="tenantId">The target tenant ID to switch to.</param>
    /// <returns>An <see cref="AuthResponse"/> with new JWT tokens reflecting the switched tenant context.</returns>
    [HttpPost("switch/{tenantId}")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<AuthResponse>> SwitchTenant(Guid tenantId, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        string? userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        _logger.LogInformation("User {UserId} switching to tenant {TenantId}", userId, tenantId);

        Result<AuthResponse> result = await _authService.SwitchTenantAsync(userId, tenantId, ipAddress, userAgent, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Sets the specified tenant as the authenticated user's default tenant.
    /// The default tenant is used as fallback when no last-accessed tenant exists.
    /// </summary>
    /// <param name="tenantId">The tenant ID to set as default.</param>
    /// <returns>Success response if the default was updated.</returns>
    [HttpPut("default/{tenantId}")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> SetDefaultTenant(Guid tenantId, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} setting default tenant to {TenantId}", userId, tenantId);

        Result result = await _userTenantMembershipService.SetDefaultTenantAsync(userId, tenantId, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Lists soft-deleted memberships for the caller's current tenant (removed members).
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpGet("members/removed")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IReadOnlyList<RemovedTenantMemberDto>>> GetRemovedMembers(
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} listing removed members for tenant {TenantId}", userId, tenantId);
        Result<IReadOnlyList<RemovedTenantMemberDto>> result =
            await _userTenantMembershipService.GetRemovedMembersAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Restores a soft-deleted membership in the caller's current tenant, preserving the prior role.
    /// Admin/support path that bypasses the invite-gated product UI (Seat Management restores via
    /// prior-member invite confirm). After a successful restore, best-effort reclaims an open seat.
    /// Cannot restore when the user's account is retired or the reinstatement window has expired.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpPost("members/{userId:guid}/restore")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TenantMemberRoleResponse>> RestoreMember(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid requestingUserId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "User {RequestingUserId} restoring member {UserId} in tenant {TenantId}",
            requestingUserId,
            userId,
            tenantId);

        Result<UserTenantMembership> result = await _userTenantMembershipService.RestoreMembershipAsync(
            userId,
            tenantId,
            requestingUserId,
            cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        // Removal cleared the member's seat; give it back when one is free (best-effort,
        // same semantics as adding a member). Seat failure must not fail the restore.
        await _seatManagementService.TryAssignOpenSeatIfAllowedAsync(tenantId, userId, cancellationToken);

        return Ok(MapToMemberRoleResponse(result.Value));
    }

    /// <summary>
    /// Suspends a live membership in the caller's current tenant (membership-level block).
    /// Does not touch account fields. Releases access for this tenant only.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpPost("members/{userId:guid}/suspend")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(TenantMemberRoleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TenantMemberRoleResponse>> SuspendMember(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid requestingUserId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        Result membershipGuard = await EnsureCanActOnMembershipAsync(
            requestingUserId,
            userId,
            tenantId,
            "suspend",
            cancellationToken);
        if (membershipGuard.IsFailed)
            return this.HandleFluentResult(membershipGuard);

        _logger.LogInformation(
            "User {RequestingUserId} suspending member {UserId} in tenant {TenantId}",
            requestingUserId,
            userId,
            tenantId);

        Result<UserTenantMembership> result = await _userTenantMembershipService.SuspendMembershipAsync(
            userId,
            tenantId,
            requestingUserId,
            cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapToMemberRoleResponse(result.Value));
    }

    /// <summary>
    /// Resumes a suspended membership in the caller's current tenant. After a successful
    /// resume, best-effort reclaims an open seat (same semantics as adding a member).
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpPost("members/{userId:guid}/resume")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(TenantMemberRoleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TenantMemberRoleResponse>> ResumeMember(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid requestingUserId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        Result membershipGuard = await EnsureCanActOnMembershipAsync(
            requestingUserId,
            userId,
            tenantId,
            "resume",
            cancellationToken);
        if (membershipGuard.IsFailed)
            return this.HandleFluentResult(membershipGuard);

        _logger.LogInformation(
            "User {RequestingUserId} resuming member {UserId} in tenant {TenantId}",
            requestingUserId,
            userId,
            tenantId);

        Result<UserTenantMembership> result = await _userTenantMembershipService.ResumeMembershipAsync(
            userId,
            tenantId,
            requestingUserId,
            cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        // Suspend released the member's seat; give it back when one is free (best-effort,
        // same semantics as adding a member). Seat failure must not fail the resume.
        await _seatManagementService.TryAssignOpenSeatIfAllowedAsync(tenantId, userId, cancellationToken);

        return Ok(MapToMemberRoleResponse(result.Value));
    }

    /// <summary>
    /// Gets a member's role within the caller's current tenant. Requires tenant Admin or higher.
    /// Scoped to the caller's active tenant; cross-tenant lookups are not possible.
    /// </summary>
    /// <param name="userId">The member whose tenant role is requested.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The member's <see cref="TenantMemberRoleResponse"/> for the current tenant.</returns>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpGet("members/{userId:guid}/role")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantMemberRoleResponse>> GetMemberRole(Guid userId, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        Result<UserTenantMembership> result =
            await _userTenantMembershipService.GetLiveMembershipAsync(userId, tenantId, cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapToMemberRoleResponse(result.Value));
    }

    /// <summary>
    /// Updates a member's role within the caller's current tenant. Requires tenant Admin or higher.
    /// The caller may neither assign a role above their own level, change their own role, nor
    /// modify a member who currently outranks them. Scoped to the caller's active tenant.
    /// </summary>
    /// <param name="userId">The member whose tenant role is being changed.</param>
    /// <param name="request">The <see cref="UpdateTenantMemberRoleRequest"/> containing the new role.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The updated <see cref="TenantMemberRoleResponse"/>.</returns>
    [AuditLog("Update", "tenant-membership")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpPut("members/{userId:guid}/role")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantMemberRoleResponse>> UpdateMemberRole(Guid userId, [FromBody] UpdateTenantMemberRoleRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid requestingUserId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        // Only recognised, non-global tenant roles may be assigned here.
        if (UserExtensions.GetRoleHierarchyLevel(request.Role) == 0 || request.Role == AuthRoles.Administrator)
            return this.HandleFluentResult(Result.Fail(new BadRequestError($"'{request.Role}' is not a valid tenant role.")));

        // A user cannot change their own tenant role.
        if (requestingUserId == userId)
            return this.HandleFluentResult(Result.Fail(new ForbiddenError("You cannot change your own tenant role.")));

        // The caller cannot assign a role above their own level.
        if (!User.CanManageRoles([request.Role]))
            return this.HandleFluentResult(Result.Fail(new ForbiddenError("You cannot assign a role higher than your own.")));

        // The caller cannot modify a member who currently outranks them.
        Result<string> currentRoleResult = await _userTenantMembershipService.GetUserRoleInTenantAsync(userId, tenantId, cancellationToken);
        if (currentRoleResult.IsFailed)
            return this.HandleFluentResult(currentRoleResult.ToResult());

        if (!User.CanModifyUser([currentRoleResult.Value]))
            return this.HandleFluentResult(Result.Fail(new ForbiddenError("You cannot modify a member who outranks you.")));

        // Only the tenant owner (or a global admin) may change the owner's role.
        Result ownerGuard = await EnsureCanActOnTenantOwnerAsync(userId, tenantId, cancellationToken);
        if (ownerGuard.IsFailed)
            return this.HandleFluentResult(ownerGuard);

        _logger.LogInformation("User {RequestingUserId} updating tenant role for member {UserId} to {Role} in tenant {TenantId}", requestingUserId, userId, request.Role, tenantId);

        Result<UserTenantMembership> result = await _userTenantMembershipService.UpdateUserRoleInTenantAsync(userId, tenantId, request.Role, requestingUserId, cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapToMemberRoleResponse(result.Value));
    }

    /// <summary>
    /// Adds an existing user to an explicitly specified tenant. Restricted to global
    /// administrators. Creates membership with a tenant-scoped role (<c>Admin</c> or
    /// <c>Developer</c>) and best-effort assigns an open seat when seat management is
    /// already allowed for the tenant — never purchases seats or changes billing.
    /// </summary>
    /// <param name="tenantId">The tenant the user is being added to.</param>
    /// <param name="request">The user id and tenant role to assign.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The created <see cref="TenantMemberRoleResponse"/>.</returns>
    [AuditLog("Create", "tenant-membership")]
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("{tenantId:guid}/members")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TenantMemberRoleResponse>> AddMemberToTenant(
        Guid tenantId,
        [FromBody] AddTenantMemberRequest request,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid requestingUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "Administrator {RequestingUserId} adding user {UserId} to tenant {TenantId} with role {Role}",
            requestingUserId,
            request.UserId,
            tenantId,
            request.Role);

        Result<TenantMemberRoleResponse> result = await _userProvisioningService.AddExistingUserToTenantAsync(
            request.UserId,
            tenantId,
            request.Role,
            isDefault: false,
            addedByUserId: requestingUserId,
            cancellationToken: cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Removes a member from an explicitly specified tenant. Restricted to global
    /// administrators. Frees any occupied seat (the seat itself remains) and revokes
    /// membership without changing payment or subscription tier. An administrator cannot
    /// remove themselves through this endpoint.
    /// </summary>
    /// <param name="tenantId">The tenant the member is being removed from.</param>
    /// <param name="userId">The member to remove.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>No content on success.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpDelete("{tenantId:guid}/members/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RemoveMemberFromTenant(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid requestingUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "Administrator {RequestingUserId} removing user {UserId} from tenant {TenantId}",
            requestingUserId,
            userId,
            tenantId);

        Result result = await _seatManagementService.RemoveMemberAsync(
            tenantId: tenantId,
            userId: userId,
            performedByUserId: requestingUserId,
            cancellationToken: cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Updates a member's role within an explicitly specified tenant. Restricted to global
    /// administrators, who may manage a user's role in any tenant the user belongs to —
    /// including tenants the administrator is not a member of. The global tenant
    /// <c>Administrator</c> role cannot be assigned here, and an administrator cannot change
    /// their own role through this endpoint.
    /// </summary>
    /// <param name="tenantId">The tenant in which the member's role is being changed.</param>
    /// <param name="userId">The member whose tenant role is being changed.</param>
    /// <param name="request">The <see cref="UpdateTenantMemberRoleRequest"/> containing the new role.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The updated <see cref="TenantMemberRoleResponse"/>.</returns>
    [AuditLog("Update", "tenant-membership")]
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPut("{tenantId:guid}/members/{userId:guid}/role")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantMemberRoleResponse>> UpdateMemberRoleInTenant(Guid tenantId, Guid userId, [FromBody] UpdateTenantMemberRoleRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid requestingUserId);
        if (authFailure is not null)
            return authFailure;

        if (UserExtensions.GetRoleHierarchyLevel(request.Role) == 0 || request.Role == AuthRoles.Administrator)
            return this.HandleFluentResult(Result.Fail(new BadRequestError($"'{request.Role}' is not a valid tenant role.")));

        if (requestingUserId == userId)
            return this.HandleFluentResult(Result.Fail(new ForbiddenError("You cannot change your own tenant role.")));

        _logger.LogInformation("Administrator {RequestingUserId} updating tenant role for member {UserId} to {Role} in tenant {TenantId}", requestingUserId, userId, request.Role, tenantId);

        Result<UserTenantMembership> result = await _userTenantMembershipService.UpdateUserRoleInTenantAsync(userId, tenantId, request.Role, requestingUserId, cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapToMemberRoleResponse(result.Value));
    }

    /// <summary>
    /// Extends the trial end date of a tenant's trialing subscription. Restricted to global
    /// administrators. Pushes the Stripe trial end forward and updates the tenant's trial end date.
    /// </summary>
    /// <param name="tenantId">The tenant whose trial is being extended.</param>
    /// <param name="request">The new trial end date.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The updated subscription details.</returns>
    [AuditLog("Update", "tenant-trial")]
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("{tenantId:guid}/trial/extend")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult> ExtendTrial(Guid tenantId, [FromBody] ExtendTrialRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid requestingUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "Administrator {RequestingUserId} extending trial for tenant {TenantId} to {NewTrialEndDate}",
            requestingUserId, tenantId, request.NewTrialEndDate);

        var result = await _stripeSubscriptionService.ExtendTrialAsync(tenantId, request.NewTrialEndDate, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Removes a member from the caller's current tenant. Requires tenant Admin or higher.
    /// Ends the membership and frees the seat (the seat remains available for reassignment).
    /// Does not deactivate or otherwise modify the user's VDAB account — the account and any
    /// other organization memberships are unaffected. The caller may neither remove themselves
    /// nor a member who outranks them. Scoped to the caller's active tenant.
    /// </summary>
    /// <param name="userId">The member to remove from the current tenant.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>No content on success.</returns>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpDelete("members/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveMember(Guid userId, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid requestingUserId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        Result membershipGuard = await EnsureCanActOnMembershipAsync(
            requestingUserId,
            userId,
            tenantId,
            "remove",
            cancellationToken);
        if (membershipGuard.IsFailed)
            return this.HandleFluentResult(membershipGuard);

        _logger.LogInformation("User {RequestingUserId} removing member {UserId} from tenant {TenantId}", requestingUserId, userId, tenantId);

        Result result = await _seatManagementService.RemoveMemberAsync(userId: userId, tenantId: tenantId, performedByUserId: requestingUserId, cancellationToken: cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Transfers ownership of the caller's current tenant to another active member. Only the current
    /// tenant owner or a global administrator may perform this action. The new owner is promoted to
    /// tenant Admin when their role is below that level; the previous owner's role is left unchanged.
    /// </summary>
    /// <param name="request">The <see cref="TransferTenantOwnershipRequest"/> identifying the new owner.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The updated tenant as a <see cref="TenantDto"/>.</returns>
    [AuditLog("TransferOwnership", "tenant")]
    [HttpPut("owner")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantDto>> TransferOwnership([FromBody] TransferTenantOwnershipRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid requestingUserId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        Result<Models.EF.Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
        if (tenantResult.IsFailed)
            return this.HandleFluentResult(tenantResult.ToResult());

        bool isOwner = tenantResult.Value.OwnerId == requestingUserId;
        if (!isOwner && !User.IsInRole(AuthRoles.Administrator))
            return this.HandleFluentResult(Result.Fail(new ForbiddenError("Only the tenant owner can transfer ownership.")));

        _logger.LogInformation("User {RequestingUserId} transferring ownership of tenant {TenantId} to {TargetUserId}", requestingUserId, tenantId, request.TargetUserId);

        Result<Models.EF.Tenant> result = await _tenantService.TransferOwnershipAsync(tenantId, request.TargetUserId, requestingUserId, cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapTenantToDto(result.Value));
    }

    /// <summary>
    /// Shared self / rank / tenant-owner guards for remove, suspend, and resume.
    /// </summary>
    private async Task<Result> EnsureCanActOnMembershipAsync(
        Guid requestingUserId,
        Guid targetUserId,
        Guid tenantId,
        string actionVerb,
        CancellationToken cancellationToken)
    {
        if (requestingUserId == targetUserId)
            return Result.Fail(new ForbiddenError($"You cannot {actionVerb} your own membership."));

        Result<string> currentRoleResult = await _userTenantMembershipService.GetUserRoleInTenantAsync(
            targetUserId,
            tenantId,
            cancellationToken);
        if (currentRoleResult.IsFailed)
            return currentRoleResult.ToResult();

        if (!User.CanModifyUser([currentRoleResult.Value]))
            return Result.Fail(new ForbiddenError($"You cannot {actionVerb} a member who outranks you."));

        return await EnsureCanActOnTenantOwnerAsync(targetUserId, tenantId, cancellationToken);
    }

    /// <summary>
    /// Determines whether the caller may act on (modify, remove, or deactivate) the specified member,
    /// enforcing that only the tenant owner or a global administrator may target the tenant owner.
    /// </summary>
    /// <param name="targetUserId">The member being acted upon.</param>
    /// <param name="tenantId">The caller's active tenant.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A successful <see cref="Result"/> when the action is permitted; otherwise a forbidden failure.</returns>
    private async Task<Result> EnsureCanActOnTenantOwnerAsync(Guid targetUserId, Guid tenantId, CancellationToken cancellationToken)
    {
        if (User.IsInRole(AuthRoles.Administrator))
            return Result.Ok();

        Result<Models.EF.Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
        if (tenantResult.IsFailed)
            return tenantResult.ToResult();

        Models.EF.Tenant tenant = tenantResult.Value;
        if (tenant.OwnerId == targetUserId && AuthenticatedUserId != tenant.OwnerId)
            return Result.Fail(new ForbiddenError("Only the tenant owner can modify or remove the tenant owner."));

        return Result.Ok();
    }

    /// <summary>
    /// Gets the current tenant details based on the tenant context in the JWT.
    /// </summary>
    /// <returns>The current tenant as a <see cref="TenantDto"/>.</returns>
    [HttpGet("current")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantDto>> GetCurrentTenant(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Retrieving current tenant {TenantId}", tenantId);

        Result<Models.EF.Tenant> result = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapTenantToDto(result.Value));
    }

    /// <summary>
    /// Updates the current tenant's settings. Requires TenantAdmin or higher.
    /// </summary>
    /// <param name="request">The update request.</param>
    /// <returns>The updated tenant as a <see cref="TenantDto"/>.</returns>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpPut("current")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantDto>> UpdateCurrentTenant([FromBody] UpdateTenantRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} updating current tenant {TenantId}", userId, tenantId);

        Result<Models.EF.Tenant> result = await _tenantService.UpdateTenantAsync(tenantId, request, userId, cancellationToken: cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapTenantToDto(result.Value));
    }

    /// <summary>
    /// Gets usage dashboard data for the current tenant.
    /// </summary>
    /// <returns>Usage statistics for the current tenant.</returns>
    [HttpGet("usage")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantUsageStatsDto>> GetCurrentTenantUsage(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Retrieving usage for current tenant {TenantId}", tenantId);

        Result<TenantUsageStatsDto> result = await _tenantService.GetUsageDashboardAsync(tenantId, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Creates a new tenant on behalf of a global administrator. The administrator selects the
    /// owner, who is automatically added as the tenant's TenantAdmin. Requires Global Administrator role.
    /// </summary>
    /// <param name="request">The create request, including the selected owner.</param>
    /// <returns>The created tenant as a <see cref="TenantDto"/>.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantDto>> CreateTenant([FromBody] CreateTenantRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {UserId} creating new tenant '{TenantName}'", userId, request.TenantName);

        Result<TenantDto> result = await _tenantService.CreateTenantAsAdminAsync(request, userId, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets all tenants with pagination. Requires Global Administrator role.
    /// </summary>
    /// <param name="skip">Number of records to skip (default 0).</param>
    /// <param name="take">Number of records to return (default 25).</param>
    /// <returns>A paginated list of tenants.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<PaginatedTenantsResponse>> GetAllTenants([FromQuery] int skip = 0, [FromQuery] int take = 25, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {UserId} retrieving all tenants (skip={Skip}, take={Take})", userId, skip, take);

        Result<PaginatedTenantsResponse> result = await _tenantService.GetAllTenantsAsync(skip, take, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets a tenant by ID. Requires Global Administrator role.
    /// </summary>
    /// <param name="id">The tenant's unique identifier.</param>
    /// <returns>The tenant as a <see cref="TenantDto"/>.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet("{id:guid}")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantDto>> GetTenantById(Guid id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {UserId} retrieving tenant {TenantId}", userId, id);

        Result<Models.EF.Tenant> result = await _tenantService.GetTenantAsync(id, cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapTenantToDto(result.Value));
    }

    /// <summary>
    /// Updates a tenant by ID. Requires Global Administrator role.
    /// </summary>
    /// <param name="id">The tenant's unique identifier.</param>
    /// <param name="request">The update request.</param>
    /// <returns>The updated tenant as a <see cref="TenantDto"/>.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPut("{id:guid}")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantDto>> UpdateTenantById(Guid id, [FromBody] UpdateTenantRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {UserId} updating tenant {TenantId}", userId, id);

        Result<Models.EF.Tenant> result = await _tenantService.UpdateTenantAsync(id, request, userId, cancellationToken: cancellationToken);
        if (result.IsFailed)
            return this.HandleFluentResult(result.ToResult());

        return Ok(MapTenantToDto(result.Value));
    }

    /// <summary>
    /// Gets usage dashboard data for a specific tenant by ID. Requires Global Administrator role.
    /// </summary>
    /// <param name="id">The tenant's unique identifier.</param>
    /// <returns>Usage statistics for the specified tenant.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet("{id:guid}/usage")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<TenantUsageStatsDto>> GetTenantUsageById(Guid id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {UserId} retrieving usage for tenant {TenantId}", userId, id);

        Result<TenantUsageStatsDto> result = await _tenantService.GetUsageDashboardAsync(id, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Deactivates a tenant (reversible). Marks the tenant inactive, cancels its Stripe
    /// subscription at period end on a best-effort basis, and revokes active sessions
    /// for sole-tenant users. Requires Global Administrator role.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> DeactivateTenant(Guid id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid actingUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {ActingUserId} deactivating tenant {TenantId}", actingUserId, id);
        Result result = await _tenantLifecycleService.DeactivateTenantAsync(id, actingUserId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Reactivates a previously deactivated tenant. Does not resurrect a canceled
    /// Stripe subscription. Requires Global Administrator role.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("{id:guid}/reactivate")]
    public async Task<IActionResult> ReactivateTenant(Guid id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid actingUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {ActingUserId} reactivating tenant {TenantId}", actingUserId, id);
        Result result = await _tenantLifecycleService.ReactivateTenantAsync(id, actingUserId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Cancels the tenant's Stripe subscription. When <paramref name="immediate"/> is
    /// true, the subscription ends now; otherwise it ends at the current period end.
    /// Requires Global Administrator role.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("{id:guid}/cancel-subscription")]
    public async Task<IActionResult> CancelTenantSubscription(Guid id, [FromQuery] bool immediate = false, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid actingUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "Administrator {ActingUserId} canceling subscription for tenant {TenantId} (immediate={Immediate})",
            actingUserId, id, immediate);
        Result result = await _tenantLifecycleService.CancelTenantSubscriptionAsync(id, immediate, actingUserId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Soft-deletes a tenant: cancels Stripe immediately, soft-deletes the tenant and
    /// cascades to memberships, apps, Databricks connections, seats, and pending invites.
    /// Sole-tenant users are disabled and their sessions revoked. Requires Global
    /// Administrator role.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> SoftDeleteTenant(Guid id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid actingUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogWarning("Administrator {ActingUserId} soft-deleting tenant {TenantId}", actingUserId, id);
        Result result = await _tenantLifecycleService.SoftDeleteTenantAsync(id, actingUserId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Purges the tenant and all owned rows from the database. Cancels Stripe
    /// immediately, hard-deletes memberships, apps, connections, seats, and invites,
    /// disables sole-tenant users, and revokes their sessions. Requires Global
    /// Administrator role.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpDelete("{id:guid}/purge")]
    public async Task<IActionResult> PurgeTenantData(Guid id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid actingUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogWarning("Administrator {ActingUserId} purging tenant {TenantId}", actingUserId, id);
        Result result = await _tenantLifecycleService.PurgeTenantDataAsync(id, actingUserId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Maps a live <see cref="UserTenantMembership"/> to a <see cref="TenantMemberRoleResponse"/>.
    /// </summary>
    private static TenantMemberRoleResponse MapToMemberRoleResponse(UserTenantMembership membership)
    {
        return new TenantMemberRoleResponse
        {
            UserId = membership.UserId,
            TenantId = membership.TenantId,
            Role = membership.Role,
            Status = membership.Status.ToString(),
        };
    }

    /// <summary>
    /// Maps a <see cref="Tenant"/> entity to a <see cref="TenantDto"/>.
    /// </summary>
    private static TenantDto MapTenantToDto(Models.EF.Tenant tenant)
    {
        return new TenantDto
        {
            TenantId = tenant.TenantId,
            TenantName = tenant.TenantName,
            DisplayName = tenant.DisplayName,
            IsActive = tenant.IsActive,
            SubscriptionTier = tenant.SubscriptionTier,
            BillingCycle = tenant.BillingCycle,
            MaxUsers = tenant.MaxUsers,
            MaxPublishedApps = tenant.MaxPublishedApps,
            MaxWorkspaceConnections = tenant.MaxWorkspaceConnections,
            SubscriptionStartDate = tenant.SubscriptionStartDate,
            SubscriptionEndDate = tenant.SubscriptionEndDate,
            TrialEndDate = tenant.TrialEndDate,
            AutoRenew = tenant.AutoRenew,
            OwnerId = tenant.OwnerId,
            InvoiceName = tenant.InvoiceName,
            InvoiceEmail = tenant.InvoiceEmail,
            SubscriptionStatus = tenant.SubscriptionStatus,
            BillingCustomerId = tenant.BillingCustomerId,
            StripeSubscriptionId = tenant.StripeSubscriptionId,
            CancelAtPeriodEnd = tenant.CancelAtPeriodEnd,
            CreatedOn = tenant.CreatedOn
        };
    }

    #pragma warning restore CA1873 // Avoid potentially expensive logging
}
