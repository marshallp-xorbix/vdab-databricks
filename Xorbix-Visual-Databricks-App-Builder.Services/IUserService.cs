using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing users and authentication.
/// </summary>
public interface IUserService
{
    /// <summary>
    /// Retrieves all users.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the list of <see cref="ApplicationUser"/>.</returns>
    Task<Result<IEnumerable<ApplicationUser>>> GetUsersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves soft-deleted (retired) users that have not been anonymized.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the list of retired <see cref="ApplicationUser"/>.</returns>
    Task<Result<IEnumerable<ApplicationUser>>> GetRetiredUsersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves all active users.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the list of <see cref="UserInfo"/>.</returns>
    Task<Result<IEnumerable<UserInfo>>> GetActiveUsersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves users who are members of the specified tenant.
    /// </summary>
    Task<Result<IEnumerable<ApplicationUser>>> GetUsersForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves active users who are members of the specified tenant.
    /// </summary>
    Task<Result<IEnumerable<UserInfo>>> GetActiveUsersForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a user by their ID.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the <see cref="ApplicationUser"/> if found.</returns>
    Task<Result<ApplicationUser>> GetUserByIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the current authenticated user's full profile including settings and metadata.
    /// </summary>
    /// <param name="userId">The user ID from claims.</param>
    /// <param name="activeTenantId">The active tenant ID from JWT <c>tenant_id</c>, when present.</param>
    /// <param name="activeTenantRole">The active tenant role from JWT <c>tenant_role</c>, when present.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the <see cref="UserProfileResponse"/>.</returns>
    Task<Result<UserProfileResponse>> GetCurrentUserProfileAsync(
        Guid userId,
        Guid? activeTenantId = null,
        string? activeTenantRole = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates user information.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="request">The update request containing user fields to modify.</param>
    /// <param name="updatedByUserId">The ID of the user performing the update.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result including the updated <see cref="ApplicationUser"/>.</returns>
    Task<Result<ApplicationUser>> UpdateUserAsync(Guid userId, UpdateUserRequest request, Guid updatedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates the user's profile (first name and last name).
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="request">The update profile request containing new values.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Initiates email change process by generating confirmation token and sending email.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="newEmail">The new email address.</param>
    /// <param name="currentPassword">
    /// The user's current password. Required for self-service change on password-based (non-passwordless) accounts.
    /// </param>
    /// <param name="requestedByUserId">
    /// The ID of the user requesting the change. When set to a different user than <paramref name="userId"/>,
    /// the tier gate is bypassed; callers MUST have already authorized the requester as a tenant/global admin
    /// (the controller is the authorization boundary). Self-referential values are treated as self-service.
    /// </param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ChangeEmailAsync(
        Guid userId,
        string newEmail,
        string? currentPassword = null,
        Guid? requestedByUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Initiates an admin-initiated password reset for a user.
    /// Generates reset token and sends email (different from user-initiated forgot password).
    /// </summary>
    /// <param name="userId">The user ID whose password should be reset.</param>
    /// <param name="adminUserId">The ID of the admin initiating the reset.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> AdminInitiatePasswordResetAsync(Guid userId, Guid adminUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the roles assigned to a specific user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the list of role names.</returns>
    Task<Result<IList<string>>> GetUserRolesAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Manages user roles by adding and/or removing specified roles.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="request">The <see cref="ManageUserRolesRequest"/> containing roles to add/remove.</param>
    /// <param name="adminUserId">The ID of the admin managing the roles.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the updated list of roles.</returns>
    Task<Result<IList<string>>> ManageUserRolesAsync(Guid userId, ManageUserRolesRequest request, Guid adminUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates user account settings (security and notification preferences).
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="request">The <see cref="UpdateUserSettingsRequest"/> containing settings to update.</param>
    /// <param name="updatedByUserId">The ID of the user performing the update.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the updated <see cref="ApplicationUser"/>.</returns>
    Task<Result<ApplicationUser>> UpdateUserSettingsAsync(Guid userId, UpdateUserSettingsRequest request, Guid updatedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Soft-deletes (retires) a user by deactivating the account, setting
    /// <see cref="ApplicationUser.DeletedOn"/>, and revoking all sessions.
    /// The email address is left intact; the partial unique index releases the slot.
    /// The user row is retained for audit purposes.
    /// </summary>
    /// <param name="userId">The user ID to soft-delete.</param>
    /// <param name="deletedByUserId">The ID of the admin performing the deletion.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> SoftDeleteUserAsync(Guid userId, Guid deletedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the account setup completion status for the authenticated user.
    /// Checks subscription and payment method state to determine which setup step is next.
    /// </summary>
    /// <param name="userId">The authenticated user's ID.</param>
    /// <param name="activeTenantId">The active tenant ID from JWT <c>tenant_id</c>, when present.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Account setup status indicating completion state and next step.</returns>
    Task<Result<AccountSetupStatusDto>> GetAccountSetupStatusAsync(
        Guid userId,
        Guid? activeTenantId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Records the authenticated user's acceptance of the current Terms of Service
    /// and/or Privacy Policy version(s). Stamps the configured version date and UtcNow.
    /// </summary>
    /// <param name="userId">The authenticated user's ID.</param>
    /// <param name="acceptTermsOfService">True to stamp the current Terms of Service acceptance.</param>
    /// <param name="acceptPrivacyPolicy">True to stamp the current Privacy Policy acceptance.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> AcceptPoliciesAsync(Guid userId, bool acceptTermsOfService, bool acceptPrivacyPolicy, CancellationToken cancellationToken = default);
}