using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for user provisioning flows such as self-registration and admin user creation.
/// </summary>
public interface IUserProvisioningService
{
    /// <summary>
    /// Creates a new user account with specified roles and settings.
    /// Handles both self-registration and admin-created user scenarios.
    /// </summary>
    /// <param name="request">
    /// The <see cref="CreateUserRequest"/> describing the user creation flow.
    /// Supported types: <see cref="RegisterRequest"/> and <see cref="AddUserRequest"/>.
    /// </param>
    /// <param name="createdByUserId">The ID of the admin creating the user (null for self-registration).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <param name="callerActiveTenantId">
    /// The caller's active tenant when creating via admin APIs. Used to reject cross-tenant
    /// placement for non-global administrators.
    /// </param>
    /// <param name="callerIsGlobalAdministrator">
    /// Whether the caller holds the global Administrator role.
    /// </param>
    /// <returns>A result containing the created <see cref="ApplicationUser"/>.</returns>
    Task<Result<ApplicationUser>> CreateUserAsync(
        CreateUserRequest request,
        Guid? createdByUserId = null,
        CancellationToken cancellationToken = default,
        Guid? callerActiveTenantId = null,
        bool callerIsGlobalAdministrator = false);

    /// <summary>
    /// Adds an existing user to a tenant with a tenant-scoped role, sets the user's home
    /// tenant when unset, and best-effort assigns an open seat when seat management is
    /// already allowed. Never purchases seats or changes subscription tier.
    /// </summary>
    /// <param name="userId">The user being added.</param>
    /// <param name="tenantId">The tenant the user is being added to.</param>
    /// <param name="role">The tenant-scoped role (<c>Admin</c> or <c>Developer</c>).</param>
    /// <param name="isDefault">Whether this membership should be the user's default tenant.</param>
    /// <param name="addedByUserId">The administrator performing the add.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The created membership role response.</returns>
    Task<Result<TenantMemberRoleResponse>> AddExistingUserToTenantAsync(
        Guid userId,
        Guid tenantId,
        string role,
        bool isDefault,
        Guid addedByUserId,
        CancellationToken cancellationToken = default);
}
