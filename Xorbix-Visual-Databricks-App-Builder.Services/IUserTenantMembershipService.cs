using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing user tenant memberships.
/// Handles multi-tenant operations including tenant switching, role retrieval, and membership management.
/// </summary>
public interface IUserTenantMembershipService
{
    /// <summary>
    /// Gets all tenant memberships for a user.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Collection of tenant memberships with Tenant entity populated.</returns>
    Task<Result<IEnumerable<UserTenantMembership>>> GetUserTenantsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the user's current/active tenant membership.
    /// Uses last-accessed tenant, falls back to default, falls back to first available.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The current tenant membership, or null if user has no memberships.</returns>
    Task<Result<UserTenantMembership?>> GetCurrentTenantAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets lightweight tenant membership DTOs for a user, including the current-tenant marker.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Collection of <see cref="TenantMembershipDto"/> for tenant switcher UI usage.</returns>
    Task<Result<IEnumerable<TenantMembershipDto>>> GetUserTenantMembershipDtosAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a specific tenant membership for a user.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The membership if found, or failure if user doesn't belong to tenant.</returns>
    Task<Result<UserTenantMembership>> GetUserTenantMembershipAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Switches the user's active tenant context.
    /// Updates LastAccessedAt and validates user belongs to the target tenant.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The target tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The new tenant membership context.</returns>
    Task<Result<UserTenantMembership>> SwitchTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the live (non-deleted) membership for a user in a tenant.
    /// </summary>
    Task<Result<UserTenantMembership>> GetLiveMembershipAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the user's role within a specific tenant.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The role name, or failure if user doesn't belong to tenant.</returns>
    Task<Result<string>> GetUserRoleInTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a user to a tenant with a specified role.
    /// Opens its own transaction scope; for callers that already hold an ambient transaction,
    /// use <see cref="AddUserToTenantWithinTransactionAsync"/> instead.
    /// Within the reinstatement window, a soft-deleted membership is reactivated with its
    /// <em>prior</em> role; <paramref name="role"/> applies only when inserting a fresh row.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="role">The tenant-specific role (Admin, Developer). Ignored when reactivating an in-window ended membership.</param>
    /// <param name="isDefault">Whether this should be the user's default tenant.</param>
    /// <param name="addedByUserId">The ID of the user adding this membership.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The created membership.</returns>
    Task<Result<UserTenantMembership>> AddUserToTenantAsync(Guid userId, Guid tenantId, string role, bool isDefault = false, Guid? addedByUserId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a user to a tenant without opening a new transaction scope.
    /// Must be called within an ambient <see cref="System.Transactions.TransactionScope"/>.
    /// Within the reinstatement window, a soft-deleted membership is reactivated with its
    /// <em>prior</em> role; <paramref name="role"/> applies only when inserting a fresh row
    /// (outside the window or no prior membership).
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="role">The tenant-specific role (Admin, Developer). Ignored when reactivating an in-window ended membership.</param>
    /// <param name="isDefault">Whether this should be the user's default tenant.</param>
    /// <param name="addedByUserId">The ID of the user adding this membership.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The created or reactivated membership.</returns>
    Task<Result<UserTenantMembership>> AddUserToTenantWithinTransactionAsync(
        Guid userId,
        Guid tenantId,
        string role,
        bool isDefault = false,
        Guid? addedByUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists soft-deleted memberships for a tenant (removed members) that are eligible
    /// for tenant recovery. Retired and anonymized accounts are excluded, as are emails
    /// that already have a pending invite for this tenant.
    /// </summary>
    Task<Result<IReadOnlyList<RemovedTenantMemberDto>>> GetRemovedMembersAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Restores a soft-deleted membership, preserving the prior role.
    /// Direct admin/support path (bypasses the invite-gated product UI). Seat reclaim is
    /// handled by the caller (best-effort assign of an open seat after a successful restore).
    /// Fails when the user's account is retired or the reinstatement window has expired.
    /// </summary>
    Task<Result<UserTenantMembership>> RestoreMembershipAsync(
        Guid userId,
        Guid tenantId,
        Guid restoredByUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Suspends a live membership in this tenant (tenant-admin block). Releases access
    /// without ending the membership. Does not touch account fields.
    /// </summary>
    Task<Result<UserTenantMembership>> SuspendMembershipAsync(
        Guid userId,
        Guid tenantId,
        Guid suspendedByUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resumes a suspended membership to Active. Seat reclaim is handled by the caller
    /// (best-effort assign of an open seat after a successful resume).
    /// </summary>
    Task<Result<UserTenantMembership>> ResumeMembershipAsync(
        Guid userId,
        Guid tenantId,
        Guid resumedByUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Ends every live membership for the user (clears seats, Status=Ended) as part of
    /// platform account retirement. Must run inside an ambient transaction. Writes a
    /// per-membership audit row. Does not revoke sessions — the caller should revoke
    /// after the transaction completes.
    /// </summary>
    Task<Result<IReadOnlyList<Guid>>> EndAllLiveMembershipsForPlatformRetirementAsync(
        Guid userId,
        Guid performedByUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a user from a tenant.
    /// Opens its own transaction scope; for callers that already hold an ambient transaction,
    /// use <see cref="RemoveUserFromTenantWithinTransactionAsync"/> instead.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="deletedByUserId">The user performing the removal, when known.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> RemoveUserFromTenantAsync(
        Guid userId,
        Guid tenantId,
        Guid? deletedByUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a user from a tenant without opening a new transaction scope.
    /// Must be called within an ambient <see cref="System.Transactions.TransactionScope"/>.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="deletedByUserId">The user performing the removal, when known.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> RemoveUserFromTenantWithinTransactionAsync(
        Guid userId,
        Guid tenantId,
        Guid? deletedByUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates a user's role within a tenant.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="newRole">The new role to assign.</param>
    /// <param name="updatedByUserId">The ID of the user making the change.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The updated membership.</returns>
    Task<Result<UserTenantMembership>> UpdateUserRoleInTenantAsync(Guid userId, Guid tenantId, string newRole, Guid? updatedByUserId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets a tenant as the user's default.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID to set as default.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result.</returns>
    Task<Result> SetDefaultTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a user has Active access to a specific tenant.
    /// </summary>
    /// <param name="userId">The user's ID.</param>
    /// <param name="tenantId">The tenant's ID.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>True if the user has an Active membership in the tenant.</returns>
    Task<bool> UserBelongsToTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// True when the user has any non-deleted membership (Active or Suspended) in any tenant.
    /// </summary>
    Task<bool> HasLiveMembershipAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns success when the ended membership is still within the configured
    /// reinstatement window (or the window is disabled).
    /// </summary>
    Result EnsureWithinReinstatementWindow(UserTenantMembership membership);
}
