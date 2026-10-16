using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Server.Middleware;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Controller for managing users.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="UserController"/> class.
/// </remarks>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UserController(
    ILogger<UserController> _logger,
    IUserService _userService,
    IUserProvisioningService _userProvisioningService,
    IUserLifecycleService _userLifecycleService,
    IUserSessionService _userSessionService,
    ISessionTokenSecurityService _sessionTokenSecurityService,
    IUserTenantMembershipService _userTenantMembershipService,
    IAuthService _authService) : AuthenticatedControllerBase
{
    /// <summary>
    /// Enforces that non-global-administrator callers acting on another user are members of
    /// the same tenant. Global administrators bypass. Callers may always act on themselves.
    /// Account-level mutations use <see cref="EnsureSelfOrAdministratorAsync"/> instead —
    /// tenant admins no longer administer accounts (Phase 4).
    /// </summary>
    private async Task<Result> EnforceTenantScopeAsync(Guid targetUserId, CancellationToken cancellationToken = default)
    {
        if (User.IsInRole(AuthRoles.Administrator))
            return Result.Ok();

        if (AuthenticatedUserId is Guid callerId && callerId == targetUserId)
            return Result.Ok();

        Guid? callerTenantId = AuthenticatedTenantId;
        if (callerTenantId is null)
            return Result.Fail(new ForbiddenError("No active tenant context."));

        bool belongs = await _userTenantMembershipService.UserBelongsToTenantAsync(targetUserId, callerTenantId.Value, cancellationToken);
        if (!belongs)
            return Result.Fail(new ForbiddenError("This user is not a member of your tenant."));

        return Result.Ok();
    }

    /// <summary>
    /// Gates account-level mutations to the account holder or a global Administrator.
    /// </summary>
    private Result EnsureSelfOrAdministrator(Guid targetUserId)
    {
        if (User.IsInRole(AuthRoles.Administrator))
            return Result.Ok();

        if (AuthenticatedUserId is Guid callerId && callerId == targetUserId)
            return Result.Ok();

        return Result.Fail(new ForbiddenError(
            "Only the account holder or a platform administrator may change account settings."));
    }

    /// <summary>
    /// Checks if the current user has sufficient permissions to modify the target user.
    /// Administrators bypass the check. Other roles must have role level >= target user's role level.
    /// </summary>
    /// <param name="targetUserId">The ID of the user to be modified.</param>
    /// <param name="requestingUserId">The ID of the user making the request.</param>
    /// <param name="actionName">The name of the action being performed (for logging).</param>
    /// <returns>True if authorized, false if not authorized.</returns>
    private async Task<bool> CheckUserModificationPermissions(Guid targetUserId, Guid requestingUserId, string actionName)
    {
        if (User.IsInRole(AuthRoles.Administrator)) return true;

        Result<IList<string>> targetUserRolesResult = await _userService.GetUserRolesAsync(targetUserId);
        if (targetUserRolesResult.IsSuccess && !User.CanModifyUser(targetUserRolesResult.Value))
        {
            _logger.LogWarning("User {RequestingUserId} attempted to {ActionName} user {UserId} without sufficient permissions",
                requestingUserId, actionName, targetUserId);
            return false;
        }

        return true;
    }

    /// <summary>
    /// Gets all users.
    /// </summary>
    /// <returns>List of <see cref="ApplicationUser"/>.</returns>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpGet]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IEnumerable<ApplicationUser>>> GetUsers()
    {
        if (User.IsInRole(AuthRoles.Administrator))
        {
            ActionResult? authFailure = RequireAuthenticatedUser(out Guid adminUserId);
            if (authFailure is not null)
                return authFailure;

            _logger.LogInformation("Administrator {UserId} requesting list of all users", adminUserId);
            Result<IEnumerable<ApplicationUser>> allUsersResult = await _userService.GetUsersAsync();
            return this.HandleFluentResult(allUsersResult);
        }

        ActionResult? tenantAuthFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (tenantAuthFailure is not null)
            return tenantAuthFailure;

        _logger.LogInformation("User {UserId} requesting users for tenant {TenantId}", userId, tenantId);
        Result<IEnumerable<ApplicationUser>> result = await _userService.GetUsersForTenantAsync(tenantId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets soft-deleted (retired) users that have not been anonymized.
    /// Global administrators only. Used by the Removed &amp; deleted admin filter.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpGet("retired")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<ApplicationUser>>> GetRetiredUsers()
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid adminUserId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {UserId} requesting retired users", adminUserId);
        Result<IEnumerable<ApplicationUser>> result = await _userService.GetRetiredUsersAsync();
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets all active users.
    /// </summary>
    /// <returns>List of <see cref="UserInfo"/>.</returns>
    [HttpGet("active")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IEnumerable<UserInfo>>> GetActiveUsers()
    {
        if (User.IsInRole(AuthRoles.Administrator))
        {
            ActionResult? authFailure = RequireAuthenticatedUser(out Guid adminUserId);
            if (authFailure is not null)
                return authFailure;

            _logger.LogInformation("Administrator {UserId} requesting list of active users", adminUserId);
            Result<IEnumerable<UserInfo>> allActiveResult = await _userService.GetActiveUsersAsync();
            return this.HandleFluentResult(allActiveResult);
        }

        ActionResult? tenantAuthFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (tenantAuthFailure is not null)
            return tenantAuthFailure;

        _logger.LogInformation("User {UserId} requesting active users for tenant {TenantId}", userId, tenantId);
        Result<IEnumerable<UserInfo>> result = await _userService.GetActiveUsersForTenantAsync(tenantId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets the active users belonging to the caller's current tenant.
    /// </summary>
    /// <returns>List of <see cref="UserInfo"/> scoped to the caller's tenant.</returns>
    [HttpGet("active/tenant")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IEnumerable<UserInfo>>> GetActiveUsersForTenant()
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} requesting active users for tenant {TenantId}", userId, tenantId);
        Result<IEnumerable<UserInfo>> result = await _userService.GetActiveUsersForTenantAsync(tenantId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Adds a new user with specified roles (admin function).
    /// </summary>
    /// <param name="request">The <see cref="AddUserRequest"/> containing user details and roles.</param>
    /// <returns>The added user <see cref="ApplicationUser"/> </returns>
    [AuditLog("Create", "user")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpPost]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<ApplicationUser>> AddUser([FromBody] AddUserRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        // A non-global tenant admin may only attach a newly created user to their OWN tenant.
        // Cross-tenant placement is a global-administrator operation.
        if (request.TenantId.HasValue
            && !User.IsInRole(AuthRoles.Administrator)
            && request.TenantId != AuthenticatedTenantId)
        {
            return this.HandleFluentResult(
                Result.Fail(new ForbiddenError("You may only add users to your current tenant.")));
        }

        _logger.LogInformation(
            "User {AdminUserId} adding new user {Email} with roles [{Roles}]",
            userId, request.Email, string.Join(", ", request.Roles));

        Result<ApplicationUser> result = await _userProvisioningService.CreateUserAsync(
            request,
            userId,
            cancellationToken: default,
            callerActiveTenantId: AuthenticatedTenantId,
            callerIsGlobalAdministrator: User.IsInRole(AuthRoles.Administrator));

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets a user by ID.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>The <see cref="ApplicationUser"/>.</returns>
    [HttpGet("{id:guid}")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<ApplicationUser>> GetUser(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        // Prevent users from accessing other users' data unless they have elevated permissions
        if (userId != id && !User.HasElevatedPermissions())
        {
            _logger.LogWarning("User {RequestingUserId} attempted to access user details for UserId {UserId} without permission", userId, id);
            return Forbid();
        }

        Result tenantScope = await EnforceTenantScopeAsync(id);
        if (tenantScope.IsFailed)
            return this.HandleFluentResult(tenantScope);

        _logger.LogInformation("User {RequestingUserId} requesting user details for UserId {UserId}", userId, id);

        Result<ApplicationUser> result = await _userService.GetUserByIdAsync(id);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Updates a user's information.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <param name="request">The update request.</param>
    /// <returns>The updated user.</returns>
    [AuditLog("Update", "user")]
    [HttpPut("{id:guid}")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<ApplicationUser>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result accountScope = EnsureSelfOrAdministrator(id);
        if (accountScope.IsFailed)
            return this.HandleFluentResult(accountScope);

        if (!await CheckUserModificationPermissions(id, userId, "update"))
        {
            return Forbid();
        }

        _logger.LogInformation("User {RequestingUserId} updating user {UserId}", userId, id);

        Result<ApplicationUser> result = await _userService.UpdateUserAsync(id, request, userId);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Deactivates a user account (Xorbix account Suspended). Tenant admins must use
    /// membership suspend instead.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>No content on success.</returns>
    [AuditLog("Deactivate", "user")]
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeactivateUser(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        if (!await CheckUserModificationPermissions(id, userId, "deactivate"))
        {
            return Forbid();
        }

        _logger.LogInformation("Administrator {RequestingUserId} deactivating user {UserId}", userId, id);

        Result result = await _userLifecycleService.DeactivateUserAsync(id, userId);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Enables two-factor authentication for a user account.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>No content on success.</returns>
    [Authorize]
    [HttpPost("{id:guid}/2fa/enable")]
    public async Task<IActionResult> Enable2FA(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result accountScope = EnsureSelfOrAdministrator(id);
        if (accountScope.IsFailed)
            return this.HandleFluentResult(accountScope);

        _logger.LogInformation("User {RequestingUserId} enabling 2FA for user {UserId}", userId, id);

        Result result = await _authService.Enable2FAAsync(id, userId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Disables two-factor authentication for a user account.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>No content on success.</returns>
    [Authorize]
    [HttpPost("{id:guid}/2fa/disable")]
    public async Task<IActionResult> Disable2FA(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result accountScope = EnsureSelfOrAdministrator(id);
        if (accountScope.IsFailed)
            return this.HandleFluentResult(accountScope);

        _logger.LogInformation("User {RequestingUserId} disabling 2FA for user {UserId}", userId, id);

        Result result = await _authService.Disable2FAAsync(id, userId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Initiates email change for a user. Sends confirmation email to new address.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <param name="request">The <see cref="ChangeEmailRequest"/> containing the new email.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure response.</returns>
    [AuditLog("Update", "user")]
    [Authorize]
    [HttpPut("{id:guid}/email")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ChangeEmail(
        Guid id,
        [FromBody] ChangeEmailRequest request,
        CancellationToken cancellationToken = default)
    {
        //TODO: create table for pending email changes to track requests

        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        _logger.LogInformation("Change email attempt for user {Id} from user {RequestingUserId} from IP {IpAddress}", id, userId, ipAddress);

        Result accountScope = EnsureSelfOrAdministrator(id);
        if (accountScope.IsFailed)
            return this.HandleFluentResult(accountScope);

        Result result = await _userService.ChangeEmailAsync(
            id,
            request.NewEmail,
            requestedByUserId: userId,
            cancellationToken: cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Re-sends the email confirmation for a user whose email is not confirmed.
    /// Useful when the confirmation email expires or is lost.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>No content on success.</returns>
    [Authorize]
    [HttpPost("{id:guid}/email/resend-confirmation")]
    public async Task<IActionResult> ResendConfirmation(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result accountScope = EnsureSelfOrAdministrator(id);
        if (accountScope.IsFailed)
            return this.HandleFluentResult(accountScope);

        _logger.LogInformation("User {RequestingUserId} resending confirmation for user {UserId}", userId, id);

        // Get user info to retrieve email
        Result<ApplicationUser> userResult = await _userService.GetUserByIdAsync(id);
        if (userResult.IsFailed || userResult.Value == null)
        {
            return NotFound();
        }
        ApplicationUser user = userResult.Value;
        if (user.EmailConfirmed)
        {
            return BadRequest("Email is already confirmed.");
        }

        Result result = await _authService.ResendConfirmationEmailAsync(user.Email!);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Initiates an admin-initiated password reset for a user.
    /// Generates reset token and sends email (different from user-initiated forgot password).
    /// </summary>
    /// <param name="id">The user ID whose password should be reset.</param>
    /// <returns>No content on success.</returns>
    [Authorize]
    [HttpPost("{id:guid}/password/reset")]
    public async Task<IActionResult> InitiatePasswordReset(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result accountScope = EnsureSelfOrAdministrator(id);
        if (accountScope.IsFailed)
            return this.HandleFluentResult(accountScope);

        _logger.LogInformation("User {AdminUserId} initiating password reset for user {UserId}", userId, id);

        Result result = await _userService.AdminInitiatePasswordResetAsync(id, userId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets the roles assigned to a specific user.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>List of role names.</returns>
    [HttpGet("{id:guid}/roles")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IList<string>>> GetUserRoles(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        // Prevent users from accessing other users' roles unless they have elevated permissions
        if (userId != id && !User.HasElevatedPermissions())
        {
            _logger.LogWarning("User {RequestingUserId} attempted to access roles for UserId {UserId} without permission", userId, id);
            return Forbid();
        }

        Result tenantScope = await EnforceTenantScopeAsync(id);
        if (tenantScope.IsFailed)
            return this.HandleFluentResult(tenantScope);

        _logger.LogInformation("User {RequestingUserId} requesting roles for user {UserId}", userId, id);

        Result<IList<string>> result = await _userService.GetUserRolesAsync(id);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Manages user roles by adding and/or removing specified roles.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <param name="request">The <see cref="ManageUserRolesRequest"/> containing roles to add/remove.</param>
    /// <returns>Updated list of role names.</returns>
    [AuditLog("Update", "user")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpPut("{id:guid}/roles")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IList<string>>> ManageUserRoles(Guid id, [FromBody] ManageUserRolesRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result tenantScope = await EnforceTenantScopeAsync(id);
        if (tenantScope.IsFailed)
            return this.HandleFluentResult(tenantScope);

        // Check if requesting user has sufficient permissions to modify target user
        if (!User.IsInRole(AuthRoles.Administrator))
        {
            Result<IList<string>> targetUserRolesResult = await _userService.GetUserRolesAsync(id);
            if (targetUserRolesResult.IsSuccess && !User.CanModifyUser(targetUserRolesResult.Value))
            {
                _logger.LogWarning("User {RequestingUserId} attempted to manage roles for user {UserId} without sufficient permissions", userId, id);
                return Forbid();
            }

            // Check if requesting user has sufficient permissions to grant/revoke the specified roles
            List<string> rolesToManage = [];
            if (request.RolesToAdd != null) rolesToManage.AddRange(request.RolesToAdd);
            if (request.RolesToRemove != null) rolesToManage.AddRange(request.RolesToRemove);

            if (rolesToManage.Count > 0 && !User.CanManageRoles(rolesToManage))
            {
                _logger.LogWarning("User {RequestingUserId} attempted to manage roles they don't have permission to grant/revoke", userId);
                return Forbid();
            }
        }

        _logger.LogInformation("Admin {AdminUserId} managing roles for user {UserId}. Adding: [{RolesToAdd}], Removing: [{RolesToRemove}]",
            userId, id,
            request.RolesToAdd != null ? string.Join(", ", request.RolesToAdd) : "none",
            request.RolesToRemove != null ? string.Join(", ", request.RolesToRemove) : "none");

        Result<IList<string>> result = await _userService.ManageUserRolesAsync(id, request, userId);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Forces logout of sessions for the target user. The account holder and Xorbix operators
    /// revoke every session; a tenant admin acting on another member stays scoped to their
    /// own tenant and does not rotate the account-wide security stamp.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>No content on success.</returns>
    [AuditLog("Logout", "user")]
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpDelete("{id:guid}/sessions")]
    public async Task<IActionResult> ForceLogoutAllDevices(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result tenantScope = await EnforceTenantScopeAsync(id);
        if (tenantScope.IsFailed)
            return this.HandleFluentResult(tenantScope);

        _logger.LogInformation("User {RequestingUserId} forcing logout on devices for user {UserId}", userId, id);

        Result<Guid?> filterResult = ResolveSessionTenantFilter(id, userId);
        if (filterResult.IsFailed)
            return this.HandleFluentResult(filterResult.ToResult());

        if (filterResult.Value is null)
        {
            Result globalResult = await _sessionTokenSecurityService.ForceLogoutAllDevicesAsync(id);
            return this.HandleFluentResult(globalResult);
        }

        Result result = await _sessionTokenSecurityService.ForceLogoutTenantSessionsAsync(id, filterResult.Value.Value);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets paginated sessions (login chains) for a user. The account holder and Xorbix
    /// operators see every session; a tenant admin acting on another member is scoped to
    /// their own tenant. Each row represents one login (rotation chain), not one refresh-token rotation.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <param name="skip">Number of sessions to skip (default 0).</param>
    /// <param name="take">Number of sessions to return (default 25).</param>
    /// <param name="activeOnly">When true (default), only sessions with at least one live token are returned.</param>
    /// <returns>Paginated sessions with total count.</returns>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [HttpGet("{id:guid}/sessions")]
    public async Task<IActionResult> GetUserSessions(Guid id, [FromQuery] int skip = 0, [FromQuery] int take = 25, [FromQuery] bool activeOnly = true)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result tenantScope = await EnforceTenantScopeAsync(id);
        if (tenantScope.IsFailed)
            return this.HandleFluentResult(tenantScope);

        Result<Guid?> filterResult = ResolveSessionTenantFilter(id, userId);
        if (filterResult.IsFailed)
            return this.HandleFluentResult(filterResult.ToResult());

        Result<UserSessionsResponse> result = await _userSessionService.GetUserSessionsAsync(
            id, skip, take, activeOnly, TryGetCurrentSessionId(), filterResult.Value);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Revokes (terminates) a specific user session. The account holder and Xorbix operators
    /// may revoke any of the target's sessions; a tenant admin acting on another member is
    /// scoped to their own tenant.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <param name="sessionId">The session (refresh token) ID to revoke.</param>
    /// <returns>The revoke result, including whether the caller's current session was revoked.</returns>
    [Authorize(Policy = AuthPolicies.RequireTenantAdminRole)]
    [ProducesResponseType(typeof(RevokeSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [HttpDelete("{id:guid}/sessions/{sessionId:int}")]
    public async Task<ActionResult<RevokeSessionResponse>> RevokeSession(Guid id, int sessionId)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result tenantScope = await EnforceTenantScopeAsync(id);
        if (tenantScope.IsFailed)
            return this.HandleFluentResult(tenantScope);

        Result<Guid?> filterResult = ResolveSessionTenantFilter(id, userId);
        if (filterResult.IsFailed)
            return this.HandleFluentResult(filterResult.ToResult());

        _logger.LogInformation("User {RequestingUserId} revoking session {SessionId} for user {UserId}", userId, sessionId, id);

        Result<RevokeSessionResponse> result = await _userSessionService.RevokeSessionAsync(
            id, sessionId, userId, TryGetCurrentSessionId(), filterResult.Value);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Resolves whether session list/revoke/force-logout should be account-wide (<c>null</c>)
    /// or limited to the caller's active tenant. Account-wide for the account holder and
    /// global Administrators; tenant-scoped for tenant admins acting on another member.
    /// </summary>
    private Result<Guid?> ResolveSessionTenantFilter(Guid targetUserId, Guid callerUserId)
    {
        bool accountWideScope = callerUserId == targetUserId || User.IsInRole(AuthRoles.Administrator);
        if (accountWideScope)
            return Result.Ok<Guid?>(null);

        if (AuthenticatedTenantId is not Guid callerTenantId)
            return Result.Fail(new ForbiddenError("No active tenant context."));

        return Result.Ok<Guid?>(callerTenantId);
    }

    /// <summary>
    /// Locks a user account (admin function).
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>No content on success.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("{id:guid}/lock")]
    public async Task<IActionResult> LockUser(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        if (!await CheckUserModificationPermissions(id, userId, "lock"))
        {
            return Forbid();
        }

        _logger.LogInformation("Administrator {AdminUserId} locking user {UserId}", userId, id);

        Result result = await _userLifecycleService.LockUserAsync(id, userId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Unlocks a user account (platform administrator only).
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>No content on success.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("{id:guid}/unlock")]
    public async Task<IActionResult> UnlockUser(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {AdminUserId} unlocking user {UserId}", userId, id);

        Result result = await _userLifecycleService.UnlockUserAsync(id, userId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Restores a previously deactivated or retired user account (clears soft-delete tombstone).
    /// Platform administrators only.
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <returns>No content on success.</returns>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpPost("{id:guid}/reactivate")]
    public async Task<IActionResult> ReactivateUser(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {RequestingUserId} restoring user {UserId}", userId, id);

        Result result = await _userLifecycleService.ReactivateUserAsync(id, userId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Updates a user's account settings (security and notification preferences).
    /// </summary>
    /// <param name="id">The user ID.</param>
    /// <param name="request">The <see cref="UpdateUserSettingsRequest"/> containing settings to update.</param>
    /// <returns>The updated user.</returns>
    [AuditLog("Update", "user")]
    [Authorize]
    [HttpPut("{id:guid}/settings")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<ApplicationUser>> UpdateUserSettings(Guid id, [FromBody] UpdateUserSettingsRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        Result accountScope = EnsureSelfOrAdministrator(id);
        if (accountScope.IsFailed)
            return this.HandleFluentResult(accountScope);

        _logger.LogInformation("User {RequestingUserId} updating settings for user {UserId}", userId, id);

        Result<ApplicationUser> result = await _userService.UpdateUserSettingsAsync(id, request, userId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Soft-deletes (retires) a user without rewriting their email address.
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpDelete("{id:guid}/soft-delete")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult> SoftDeleteUser(Guid id)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Admin {RequestingUserId} soft-deleting user {UserId}", userId, id);

        Result result = await _userService.SoftDeleteUserAsync(id, userId);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Permanently purges all data associated with a user (GDPR).
    /// </summary>
    [Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
    [HttpDelete("{id:guid}/purge")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult> PurgeUserData(Guid id, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Admin {RequestingUserId} purging data for user {UserId}", userId, id);

        Result result = await _userLifecycleService.PurgeUserDataAsync(id, userId, cancellationToken);

        return this.HandleFluentResult(result);
    }
}