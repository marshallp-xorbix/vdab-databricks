using System.Transactions;
using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing users and authentication.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="UserService"/> class.
/// </remarks>
public class UserService(
    ILogger<UserService> _logger,
    UserManager<ApplicationUser> _userManager,
    IUserRepository _userRepository,
    IRefreshTokenRepository _refreshTokenRepository,
    IEmailSenderService _emailSender,
    IUserTenantMembershipService _userTenantMembershipService,
    ITenantRepository _tenantRepository,
    ITenantAccessRevocationService _tenantAccessRevocationService,
    IBillingService _billingService,
    IBetaCodeRepository _betaCodeRepository,
    IInternalDevTenantService _internalDevTenantService,
    IOptions<PolicyConsentConfiguration> _policyConsentOptions,
    IOptions<AuthenticationConfiguration> _authenticationOptions,
    IAuditLogService _auditLogService) : IUserService
{
    private const string AuditUserAgent = "UserService";
    private const string AuditIp = "internal-service";
    private const string EntityTypeUser = "User";
    private const string ActionTypeUserSoftDelete = "UserSoftDelete";


    /// <inheritdoc/>
    public async Task<Result<IEnumerable<ApplicationUser>>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<ApplicationUser> users = await _userRepository.GetUsersWithRolesAsync(cancellationToken);
            return Result.Ok(users);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving users");
            return Result.Fail<IEnumerable<ApplicationUser>>($"Error retrieving users: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IEnumerable<ApplicationUser>>> GetRetiredUsersAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<ApplicationUser> users = await _userRepository.GetRetiredUsersWithRolesAsync(cancellationToken);
            return Result.Ok(users);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving retired users");
            return Result.Fail<IEnumerable<ApplicationUser>>(new ExceptionalError("Error retrieving retired users.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IEnumerable<ApplicationUser>>> GetUsersForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<ApplicationUser> users = await _userRepository.GetUsersWithRolesForTenantAsync(tenantId, cancellationToken);
            return Result.Ok(users);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving users for tenant {TenantId}", tenantId);
            return Result.Fail<IEnumerable<ApplicationUser>>($"Error retrieving users: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IEnumerable<UserInfo>>> GetActiveUsersForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<ApplicationUser> activeUsers = await _userRepository.GetActiveUsersWithRolesForTenantAsync(tenantId, cancellationToken);
            IEnumerable<UserInfo> userInfoList = activeUsers.Select(u => new UserInfo
            {
                UserId = u.Id,
                UserName = u.UserName!,
                Email = u.Email!,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Roles = u.Roles
            });

            return Result.Ok(userInfoList);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active users for tenant {TenantId}", tenantId);
            return Result.Fail<IEnumerable<UserInfo>>($"Error retrieving active users: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IEnumerable<UserInfo>>> GetActiveUsersAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<ApplicationUser> activeUsers = await _userRepository.GetActiveUsersWithRolesAsync(cancellationToken);

            IEnumerable<UserInfo> userInfoList = activeUsers.Select(u => new UserInfo
            {
                UserId = u.Id,
                UserName = u.UserName!,
                Email = u.Email!,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Roles = u.Roles
            });

            return Result.Ok(userInfoList);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active users");
            return Result.Fail<IEnumerable<UserInfo>>($"Error retrieving users: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<ApplicationUser>> GetUserByIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found", userId);
                return Result.Fail<ApplicationUser>($"User with ID {userId} not found");
            }

            await PopulateTenantMembershipsSummaryAsync(user, cancellationToken);

            return Result.Ok(user);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user with ID {UserId}", userId);
            return Result.Fail<ApplicationUser>($"Error retrieving user: {ex.Message}");
        }
    }

    /// <summary>
    /// Populates the user's per-tenant membership summary (role, owner, and primary
    /// flags) so detail surfaces can manage roles across every tenant the user
    /// belongs to without an additional round trip.
    /// </summary>
    private async Task PopulateTenantMembershipsSummaryAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        Result<IEnumerable<UserTenantMembership>> membershipsResult =
            await _userTenantMembershipService.GetUserTenantsAsync(user.Id, cancellationToken);

        if (membershipsResult.IsFailed)
        {
            user.TenantMembershipsSummary = [];
            return;
        }

        user.TenantMembershipsSummary = [.. membershipsResult.Value
            .Where(membership => membership.Tenant is not null)
            .Select(membership => new UserTenantMembershipDto
            {
                TenantId = membership.TenantId,
                TenantDisplayName = membership.Tenant!.DisplayName,
                Role = membership.Role,
                IsDefault = membership.IsDefault,
                IsPrimary = membership.IsDefault,
                IsOwner = membership.Tenant.OwnerId == user.Id,
                Status = membership.Status.ToString(),
            })
            .OrderByDescending(summary => summary.IsPrimary)
            .ThenBy(summary => summary.TenantDisplayName)];
    }

    /// <inheritdoc/>
    public async Task<Result<UserProfileResponse>> GetCurrentUserProfileAsync(
        Guid userId,
        Guid? activeTenantId = null,
        string? activeTenantRole = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found", userId);
                return Result.Fail<UserProfileResponse>(new NotFoundError("User not found"));
            }

            IList<string> roles = await _userManager.GetRolesAsync(user);

            (Guid? tenantId, string? tenantRole) = await ResolveTenantContextAsync(
                userId,
                activeTenantId,
                activeTenantRole,
                cancellationToken);

            UserProfileResponse profile = new UserProfileResponse
            {
                UserId = user.Id,
                UserName = user.UserName!,
                Email = user.Email!,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Roles = roles,
                PhoneNumber = user.PhoneNumber,
                PhoneNumberConfirmed = user.PhoneNumberConfirmed,
                EmailConfirmed = user.EmailConfirmed,
                TwoFactorEnabled = user.TwoFactorEnabled,
                UsePasswordlessLogin = user.UsePasswordlessLogin,
                EmailNotificationsEnabled = user.EmailNotificationsEnabled,
                WorkflowNotificationsEnabled = user.WorkflowNotificationsEnabled,
                CreatedOn = user.CreatedOn,
                LastLoginAt = user.LastLoginAt,
                TenantRole = tenantRole,
                TenantId = tenantId
            };

            return Result.Ok(profile);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user profile for user {UserId}", userId);
            return Result.Fail<UserProfileResponse>("Error retrieving user profile");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<ApplicationUser>> UpdateUserAsync(Guid userId, UpdateUserRequest request, Guid updatedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found", userId);
                return Result.Fail<ApplicationUser>($"User with ID {userId} not found");
            }

            user.FirstName = request.FirstName;
            user.LastName = request.LastName;
            user.ModifiedOn = DateTime.UtcNow;
            user.ModifiedBy = updatedByUserId;

            if (request.PhoneNumber != null)
            {
                user.PhoneNumber = request.PhoneNumber;
            }

            if (request.ClearAzureAdObjectId)
            {
                user.AzureAdObjectId = null;
            }
            else if (request.AzureAdObjectId != null)
            {
                user.AzureAdObjectId = request.AzureAdObjectId;
            }

            IdentityResult result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                string errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to update user {UserId}: {Errors}", userId, errors);
                return Result.Fail<ApplicationUser>($"Failed to update user: {errors}");
            }

            _logger.LogInformation("User {UserId} updated successfully", userId);
            return Result.Ok(user);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user with ID {UserId}", userId);
            return Result.Fail<ApplicationUser>($"Error updating user: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Update profile attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError("User not found"));
            }

            user.FirstName = request.FirstName;
            user.LastName = request.LastName;
            user.ModifiedBy = userId;
            user.ModifiedOn = DateTime.UtcNow;

            IdentityResult result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                _logger.LogWarning("Failed to update profile for user {UserId}: {Errors}",
                    userId, string.Join(", ", result.Errors.Select(e => e.Description)));
                return Result.Fail("Failed to update profile");
            }

            _logger.LogInformation("Profile updated successfully for user {UserId}", userId);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating profile for user {UserId}", userId);
            return Result.Fail("Failed to update profile. Please try again.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ChangeEmailAsync(
        Guid userId,
        string newEmail,
        string? currentPassword = null,
        Guid? requestedByUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Change email attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError("User not found"));
            }

            // Self-service email change is allowed for the account holder (Phase 4 / §10 rule 1).
            // Tenant admins no longer gate email changes; only self or Xorbix admin reach this path.

            // Retain password step-up only for the genuine self-service endpoint (requestedByUserId is null) —
            // the only path whose UI collects a current password. The admin endpoint already authenticates the
            // requester (RequireTenantAdminRole) and never forwards a password, so applying the step-up there
            // would be an unsatisfiable dead-end. Passwordless accounts have no password and rely on the
            // new-address confirmation link; if passwords are enabled (e.g. enterprise) this re-engages here.
            if (!requestedByUserId.HasValue
                && !_authenticationOptions.Value.PasswordlessOnly
                && await _userManager.HasPasswordAsync(user))
            {
                if (string.IsNullOrWhiteSpace(currentPassword))
                {
                    return Result.Fail(new BadRequestError("Current password is required to change email"));
                }

                if (!await _userManager.CheckPasswordAsync(user, currentPassword))
                {
                    _logger.LogWarning("Change email attempt with invalid password for user {UserId}", userId);
                    return Result.Fail(new UnauthorizedError("Invalid password"));
                }
            }

            if (string.Equals(user.Email, newEmail, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Change email attempt to current address for user {UserId}", userId);
                return Result.Fail(new BadRequestError("The new email address must be different from your current email address."));
            }

            ApplicationUser? existingUser = await _userManager.FindByEmailAsync(newEmail);
            if (existingUser != null && existingUser.Id != userId)
            {
                _logger.LogWarning("Change email attempt to already used email {NewEmail} for user {UserId}", newEmail, userId);
                return Result.Fail(new ConflictError("Email address is already in use"));
            }

            string token = await _userManager.GenerateChangeEmailTokenAsync(user, newEmail);

            string confirmationLinkUrlParams = $"{UrlParams.UserId}={user.Id}&{UrlParams.NewEmail}={Uri.EscapeDataString(newEmail)}&{UrlParams.ConfirmToken}={Uri.EscapeDataString(token)}";

            // Send the required confirmation to the new address first. The notice to the current address states
            // that a confirmation link "was sent", so it must run only after the confirmation actually succeeds;
            // if the confirmation send throws, we abort before alarming the current address for a change that failed.
            await _emailSender.SendEmailChangeConfirmationAsync(user, newEmail, confirmationLinkUrlParams, cancellationToken);

            string? currentEmail = user.Email;
            if (!string.IsNullOrWhiteSpace(currentEmail))
            {
                try
                {
                    await _emailSender.SendEmailChangeNotificationAsync(user, currentEmail, newEmail, cancellationToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(
                        ex,
                        "Failed to send email-change notification to current address for user {UserId}",
                        userId);
                }
            }

            _logger.LogInformation("Email change confirmation sent to {NewEmail} for user {UserId}", newEmail, userId);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating email change for user {UserId}", userId);
            return Result.Fail(new ExceptionalError("Failed to change email. Please try again.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> AdminInitiatePasswordResetAsync(Guid userId, Guid adminUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("Admin {AdminUserId} attempted password reset for non-existent user {UserId}", adminUserId, userId);
                return Result.Fail(new NotFoundError("User not found"));
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("Admin {AdminUserId} attempted password reset for inactive user {UserId}", adminUserId, userId);
                return Result.Fail("Cannot reset password for inactive user");
            }

            // Generate password reset token
            string token = await _userManager.GeneratePasswordResetTokenAsync(user);

            string resetLinkUrlParams = $"userId={user.Id}&token={Uri.EscapeDataString(token)}";

            // Send admin-initiated password reset email
            cancellationToken.ThrowIfCancellationRequested();
            await _emailSender.SendAdminPasswordResetAsync(user, user.Email!, resetLinkUrlParams, cancellationToken);

            _logger.LogInformation("Admin {AdminUserId} initiated password reset for user {UserId} ({Email})",
                adminUserId, user.Id, user.Email);

            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during admin-initiated password reset for user {UserId} by admin {AdminUserId}",
                userId, adminUserId);
            return Result.Fail($"Failed to initiate password reset: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IList<string>>> GetUserRolesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("Attempted to get roles for non-existent user {UserId}", userId);
                return Result.Fail<IList<string>>(new NotFoundError("User not found"));
            }

            IList<string> roles = await _userManager.GetRolesAsync(user);

            _logger.LogInformation("Retrieved {RoleCount} roles for user {UserId}", roles.Count, userId);

            return Result.Ok(roles);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving roles for user {UserId}", userId);
            return Result.Fail<IList<string>>($"Failed to retrieve user roles: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IList<string>>> ManageUserRolesAsync(Guid userId, ManageUserRolesRequest request, Guid adminUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("Admin {AdminUserId} attempted to manage roles for non-existent user {UserId}", adminUserId, userId);
                return Result.Fail<IList<string>>(new NotFoundError("User not found"));
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("Admin {AdminUserId} attempted to manage roles for inactive user {UserId}", adminUserId, userId);
                return Result.Fail<IList<string>>("Cannot manage roles for inactive user");
            }

            // Validate that at least one operation is specified
            if ((request.RolesToAdd == null || request.RolesToAdd.Count == 0) &&
                (request.RolesToRemove == null || request.RolesToRemove.Count == 0))
            {
                _logger.LogWarning("Admin {AdminUserId} attempted to manage roles for user {UserId} with no roles specified", adminUserId, userId);
                return Result.Fail<IList<string>>("No roles specified to add or remove");
            }

            // Remove roles if specified
            if (request.RolesToRemove != null && request.RolesToRemove.Count > 0)
            {
                IdentityResult removeResult = await _userManager.RemoveFromRolesAsync(user, request.RolesToRemove);
                if (!removeResult.Succeeded)
                {
                    string errors = string.Join(", ", removeResult.Errors.Select(e => e.Description));
                    _logger.LogWarning("Failed to remove roles for user {UserId}: {Errors}", userId, errors);
                    return Result.Fail<IList<string>>($"Failed to remove roles: {errors}");
                }

                _logger.LogInformation("Admin {AdminUserId} removed roles [{Roles}] from user {UserId}",
                    adminUserId, string.Join(", ", request.RolesToRemove), userId);
            }

            // Add roles if specified
            if (request.RolesToAdd != null && request.RolesToAdd.Count > 0)
            {
                IdentityResult addResult = await _userManager.AddToRolesAsync(user, request.RolesToAdd);
                if (!addResult.Succeeded)
                {
                    string errors = string.Join(", ", addResult.Errors.Select(e => e.Description));
                    _logger.LogWarning("Failed to add roles for user {UserId}: {Errors}", userId, errors);
                    return Result.Fail<IList<string>>($"Failed to add roles: {errors}");
                }

                _logger.LogInformation("Admin {AdminUserId} added roles [{Roles}] to user {UserId}",
                    adminUserId, string.Join(", ", request.RolesToAdd), userId);
            }

            // Get and return updated roles
            IList<string> updatedRoles = await _userManager.GetRolesAsync(user);

            _logger.LogInformation("Successfully managed roles for user {UserId} by admin {AdminUserId}. Current roles: [{Roles}]",
                userId, adminUserId, string.Join(", ", updatedRoles));

            return Result.Ok(updatedRoles);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error managing roles for user {UserId} by admin {AdminUserId}", userId, adminUserId);
            return Result.Fail<IList<string>>($"Failed to manage user roles: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<ApplicationUser>> UpdateUserSettingsAsync(Guid userId, UpdateUserSettingsRequest request, Guid updatedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("User with Id {UserId} not found", userId);
                return Result.Fail<ApplicationUser>($"User with Id {userId} not found");
            }

            // Passwordless-only mode pins the login method and 2FA on for every account; the client hides
            // these toggles, and this guard ignores any attempt to change them via a direct API call.
            bool passwordlessOnly = _authenticationOptions.Value.PasswordlessOnly;
            user.UsePasswordlessLogin = passwordlessOnly || request.UsePasswordlessLogin;
            user.TwoFactorEnabled = passwordlessOnly || request.TwoFactorEnabled;
            user.EmailNotificationsEnabled = request.EmailNotificationsEnabled;
            user.WorkflowNotificationsEnabled = request.WorkflowNotificationsEnabled;
            user.ModifiedOn = DateTime.UtcNow;
            user.ModifiedBy = updatedByUserId;

            IdentityResult result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                string errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to update settings for user {UserId}: {Errors}", userId, errors);
                return Result.Fail<ApplicationUser>($"Failed to update user settings: {errors}");
            }

            _logger.LogInformation("Settings updated for user {UserId} by {UpdatedByUserId}", userId, updatedByUserId);
            return Result.Ok(user);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating settings for user {UserId}", userId);
            return Result.Fail<ApplicationUser>($"Error updating user settings: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> SoftDeleteUserAsync(Guid userId, Guid deletedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("Soft-delete attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError($"User with ID {userId} not found"));
            }

            if (user.DeletedOn != null)
            {
                _logger.LogWarning("User {UserId} is already soft-deleted", userId);
                return Result.Ok();
            }

            if (await _tenantRepository.IsOwnerOfAnyTenantAsync(userId, cancellationToken))
            {
                return Result.Fail(new ConflictError(
                    "This user owns one or more workspaces. Transfer ownership before retiring the account."));
            }

            IReadOnlyList<Guid> endedTenantIds;
            using (TransactionScope transaction = new(TransactionScopeAsyncFlowOption.Enabled))
            {
                Result<IReadOnlyList<Guid>> endMembershipsResult =
                    await _userTenantMembershipService.EndAllLiveMembershipsForPlatformRetirementAsync(
                        userId,
                        deletedByUserId,
                        cancellationToken);
                if (endMembershipsResult.IsFailed)
                {
                    return Result.Fail(endMembershipsResult.Errors);
                }

                DateTime deletedOnUtc = DateTime.UtcNow;
                user.IsActive = false;
                user.DeletedOn = deletedOnUtc;
                user.DeletedBy = deletedByUserId;
                user.RetirementReason = AccountRetirementReason.Platform;
                user.ModifiedOn = deletedOnUtc;
                user.ModifiedBy = deletedByUserId;

                IdentityResult updateResult = await _userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    string errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
                    _logger.LogWarning("Failed to soft-delete user {UserId}: {Errors}", userId, errors);
                    return Result.Fail($"Failed to soft-delete user: {errors}");
                }

                await _userManager.UpdateSecurityStampAsync(user);
                await _refreshTokenRepository.RevokeAllForUserAsync(userId, cancellationToken);

                Result auditResult = await _auditLogService.LogActionAsync(
                    AuditIp,
                    AuditUserAgent,
                    ActionTypeUserSoftDelete,
                    user.TenantId,
                    deletedByUserId,
                    EntityTypeUser,
                    userId.ToString(),
                    AuditSeverities.Info,
                    metadata: null);
                if (auditResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Soft-delete for user {UserId} aborted because audit write failed: {Errors}",
                        userId,
                        string.Join(", ", auditResult.Errors.Select(error => error.Message)));
                    return Result.Fail(auditResult.Errors);
                }

                transaction.Complete();
                endedTenantIds = endMembershipsResult.Value;
            }

            // Revoke outside the scope so DB work does not run after Complete() while ambient.
            foreach (Guid tenantId in endedTenantIds)
            {
                await _tenantAccessRevocationService.RevokeAsync(userId, tenantId, cancellationToken);
            }

            _logger.LogInformation(
                "User {UserId} soft-deleted by {DeletedByUserId}; ended memberships in {TenantCount} tenant(s)",
                userId,
                deletedByUserId,
                endedTenantIds.Count);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error soft-deleting user {UserId}", userId);
            return Result.Fail($"Error soft-deleting user: {ex.Message}");
        }
    }

    //TODO: Move to a separate AccountSetupService if we end up with more account setup related methods
    /// <inheritdoc/>
    public async Task<Result<AccountSetupStatusDto>> GetAccountSetupStatusAsync(
        Guid userId,
        Guid? activeTenantId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                return Result.Fail(new UnauthorizedError("User not found"));
            }

            IList<string> userRoles = await _userManager.GetRolesAsync(user);
            bool isAdmin = userRoles.Contains(AuthRoles.Administrator);

            PolicyConsentConfiguration policyConsent = _policyConsentOptions.Value;
            bool needsTos = PolicyConsentEvaluator.RequiresTermsOfServiceAcceptance(
                user.TermsOfServiceVersionDate,
                user.TermsOfServiceAcceptedOn,
                policyConsent.TermsOfServiceVersionDate);
            bool needsPrivacy = PolicyConsentEvaluator.RequiresPrivacyPolicyAcceptance(
                user.PrivacyPolicyVersionDate,
                user.PrivacyPolicyAcceptedOn,
                policyConsent.PrivacyPolicyVersionDate);
            bool needsPolicy = needsTos || needsPrivacy;

            if (isAdmin)
            {
                // Admin users are not required to have a tenant or subscription, but they
                // still must accept the current policy versions.
                return Result.Ok(new AccountSetupStatusDto
                {
                    IsSetupComplete = !needsPolicy,
                    CurrentStep = null,
                    HasSubscription = false,
                    HasPaymentMethod = false,
                    IsAdmin = true,
                    NeedsPolicyAcceptance = needsPolicy,
                    NeedsTermsOfServiceAcceptance = needsTos,
                    NeedsPrivacyPolicyAcceptance = needsPrivacy,
                    LatestTermsOfServiceVersionDate = policyConsent.TermsOfServiceVersionDate,
                    LatestPrivacyPolicyVersionDate = policyConsent.PrivacyPolicyVersionDate
                });
            }

            Result<UserTenantMembership?> tenantResult = await ResolveActiveTenantMembershipAsync(
                userId,
                activeTenantId,
                cancellationToken);
            if (tenantResult.IsFailed || tenantResult.Value?.Tenant == null)
            {
                return Result.Ok(new AccountSetupStatusDto
                {
                    IsSetupComplete = false,
                    CurrentStep = "choose-subscription",
                    HasSubscription = false,
                    HasPaymentMethod = false,
                    IsAdmin = isAdmin,
                    NeedsPolicyAcceptance = needsPolicy,
                    NeedsTermsOfServiceAcceptance = needsTos,
                    NeedsPrivacyPolicyAcceptance = needsPrivacy,
                    LatestTermsOfServiceVersionDate = policyConsent.TermsOfServiceVersionDate,
                    LatestPrivacyPolicyVersionDate = policyConsent.PrivacyPolicyVersionDate
                });
            }

            Tenant tenant = tenantResult.Value.Tenant;

            // Non-owners inherit the tenant's billing relationship — they must not be forced
            // through owner onboarding when switching into an account they were invited/added to.
            // The actual tenant owner (payer) always sees the tenant's true billing state, even
            // when the owned tenant is not their home tenant. Internal/dev tenants skip Stripe.
            bool isNotTenantOwner = tenant.OwnerId.HasValue && tenant.OwnerId.Value != userId;
            bool inheritsTenantBilling =
                _internalDevTenantService.IsInternalDevTenant(tenant.TenantId)
                || isNotTenantOwner;

            if (inheritsTenantBilling)
            {
                return Result.Ok(new AccountSetupStatusDto
                {
                    IsSetupComplete = !needsPolicy,
                    CurrentStep = null,
                    HasSubscription = true,
                    HasPaymentMethod = true,
                    IsAdmin = isAdmin,
                    NeedsPolicyAcceptance = needsPolicy,
                    NeedsTermsOfServiceAcceptance = needsTos,
                    NeedsPrivacyPolicyAcceptance = needsPrivacy,
                    LatestTermsOfServiceVersionDate = policyConsent.TermsOfServiceVersionDate,
                    LatestPrivacyPolicyVersionDate = policyConsent.PrivacyPolicyVersionDate
                });
            }

            bool isTrialing = string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.Trialing, StringComparison.OrdinalIgnoreCase);
            bool isPaused = string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.Paused, StringComparison.OrdinalIgnoreCase);
            bool hasPaymentMethod = false;

            if (!string.IsNullOrEmpty(tenant.BillingCustomerId))
            {
                Result<IList<PaymentMethodDto>> paymentResult =
                    await _billingService.GetPaymentMethodsAsync(tenant.TenantId, cancellationToken);

                if (paymentResult.IsSuccess)
                {
                    hasPaymentMethod = paymentResult.Value.Count > 0;
                }
            }

            cancellationToken.ThrowIfCancellationRequested();

            bool needsBetaRedemptionLookup = !hasPaymentMethod
                || string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.Incomplete, StringComparison.OrdinalIgnoreCase);

            bool hasBetaRedemption = needsBetaRedemptionLookup
                && await _betaCodeRepository.HasTenantRedeemedAsync(tenant.TenantId, cancellationToken);

            bool hasSubscription = isTrialing
                || string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.Active, StringComparison.OrdinalIgnoreCase)
                || string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.PastDue, StringComparison.OrdinalIgnoreCase)
                || (hasBetaRedemption && !string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId));

            // A beta code redemption makes a card-free trial count as complete billing setup.
            // Evaluate redemption before status alone so Stripe "incomplete" (no-card beta create) still bypasses onboarding.
            bool isBetaTrial = false;
            if (!hasPaymentMethod && hasBetaRedemption)
            {
                isBetaTrial = isTrialing
                    || isPaused
                    || string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.Active, StringComparison.OrdinalIgnoreCase)
                    || (!string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId)
                        && string.Equals(tenant.SubscriptionStatus, SubscriptionStatusNames.Incomplete, StringComparison.OrdinalIgnoreCase));
            }

            bool billingComplete = hasSubscription && (hasPaymentMethod || isBetaTrial);

            // Paused tenants (no-card trial ended) stay out of onboarding: setup is complete,
            // but the account is locked via limits and a banner until a payment method is added.
            bool isComplete = (billingComplete || isPaused) && !needsPolicy;
            string? currentStep = null;

            if (!billingComplete && !isPaused)
            {
                // Neither card nor subscription → start from tier selection
                // Has card but no subscription → resume at payment to complete subscription
                // Has subscription but no card → resume at payment to add card
                currentStep = (!hasPaymentMethod && !hasSubscription) ? "choose-subscription" : "payment";
            }

            return Result.Ok(new AccountSetupStatusDto
            {
                IsSetupComplete = isComplete,
                CurrentStep = currentStep,
                HasSubscription = hasSubscription,
                HasPaymentMethod = hasPaymentMethod,
                IsPaused = isPaused,
                RequiresPaymentMethod = isPaused,
                IsAdmin = isAdmin,
                NeedsPolicyAcceptance = needsPolicy,
                NeedsTermsOfServiceAcceptance = needsTos,
                NeedsPrivacyPolicyAcceptance = needsPrivacy,
                LatestTermsOfServiceVersionDate = policyConsent.TermsOfServiceVersionDate,
                LatestPrivacyPolicyVersionDate = policyConsent.PrivacyPolicyVersionDate
            });
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting account setup status for user {UserId}", userId);
            return Result.Fail($"Error checking account setup status: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> AcceptPoliciesAsync(
        Guid userId,
        bool acceptTermsOfService,
        bool acceptPrivacyPolicy,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!acceptTermsOfService && !acceptPrivacyPolicy)
            {
                return Result.Fail(new BadRequestError("At least one policy must be accepted"));
            }

            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                return Result.Fail(new UnauthorizedError("User not found"));
            }

            PolicyConsentConfiguration policyConsent = _policyConsentOptions.Value;
            DateTime now = DateTime.UtcNow;

            if (acceptTermsOfService)
            {
                user.TermsOfServiceVersionDate = policyConsent.TermsOfServiceVersionDate;
                user.TermsOfServiceAcceptedOn = now;
            }

            if (acceptPrivacyPolicy)
            {
                user.PrivacyPolicyVersionDate = policyConsent.PrivacyPolicyVersionDate;
                user.PrivacyPolicyAcceptedOn = now;
            }

            IdentityResult updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                _logger.LogWarning("Failed to record policy acceptance for user {UserId}: {Errors}",
                    userId, string.Join(", ", updateResult.Errors.Select(e => e.Description)));
                return Result.Fail($"Failed to record policy acceptance: {string.Join(", ", updateResult.Errors.Select(e => e.Description))}");
            }

            _logger.LogInformation(
                "User {UserId} accepted policies: ToS={ToS} Privacy={Privacy}",
                userId, acceptTermsOfService, acceptPrivacyPolicy);

            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording policy acceptance for user {UserId}", userId);
            return Result.Fail($"Error recording policy acceptance: {ex.Message}");
        }
    }

    /// <summary>
    /// Resolves tenant ID and role for profile responses, preferring JWT claims when present.
    /// </summary>
    private async Task<(Guid? TenantId, string? TenantRole)> ResolveTenantContextAsync(
        Guid userId,
        Guid? activeTenantId,
        string? activeTenantRole,
        CancellationToken cancellationToken)
    {
        if (activeTenantId.HasValue)
        {
            return (activeTenantId, activeTenantRole);
        }

        Result<UserTenantMembership?> currentTenantResult = await _userTenantMembershipService.GetCurrentTenantAsync(
            userId,
            cancellationToken);
        if (currentTenantResult.IsSuccess && currentTenantResult.Value != null)
        {
            return (currentTenantResult.Value.TenantId, currentTenantResult.Value.Role);
        }

        return (null, null);
    }

    /// <summary>
    /// Loads the active tenant membership, preferring the JWT tenant when present.
    /// </summary>
    private async Task<Result<UserTenantMembership?>> ResolveActiveTenantMembershipAsync(
        Guid userId,
        Guid? activeTenantId,
        CancellationToken cancellationToken)
    {
        if (activeTenantId.HasValue)
        {
            Result<UserTenantMembership> membershipResult = await _userTenantMembershipService.GetUserTenantMembershipAsync(
                userId,
                activeTenantId.Value,
                cancellationToken);
            if (membershipResult.IsFailed)
            {
                return Result.Fail<UserTenantMembership?>(membershipResult.Errors);
            }

            return Result.Ok<UserTenantMembership?>(membershipResult.Value);
        }

        return await _userTenantMembershipService.GetCurrentTenantAsync(userId, cancellationToken);
    }

}