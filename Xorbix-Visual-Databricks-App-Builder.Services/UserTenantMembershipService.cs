using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Transactions;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing user tenant memberships.
/// </summary>
public class UserTenantMembershipService(
    ILogger<UserTenantMembershipService> _logger,
    IUserTenantMembershipRepository _membershipRepository,
    ISubscriptionSeatRepository _subscriptionSeatRepository,
    ITenantInviteRepository _tenantInviteRepository,
    UserManager<ApplicationUser> _userManager,
    IAuditLogService _auditLogService,
    ITenantAccessRevocationService _tenantAccessRevocationService,
    IOptions<AccountLifecycleConfiguration> _accountLifecycleOptions) : IUserTenantMembershipService
{

    /// <summary>
    /// Valid tenant-scoped roles that can be assigned via UserTenantMembership.
    /// Administrator is a global role stored in Identity UserRoles, not here.
    /// </summary>
    private static readonly string[] ValidTenantRoles = [AuthRoles.TenantAdmin, AuthRoles.Developer];

    private const string UserNotMemberOfTenantMessage = "User is not a member of this tenant";
    private const string AuditUserAgent = "UserTenantMembershipService";
    private const string AuditIp = "internal-service";
    private const string ActionTypeMembershipRestore = "MembershipRestore";
    private const string ActionTypeMembershipSuspend = "MembershipSuspend";
    private const string ActionTypeMembershipResume = "MembershipResume";
    private const string ActionTypeMembershipEnd = "MembershipEnd";
    private const string EntityTypeMembership = "tenant-membership";

    /// <inheritdoc/>
    public async Task<Result<IEnumerable<UserTenantMembership>>> GetUserTenantsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<UserTenantMembership> memberships = await _membershipRepository.GetByUserIdAsync(userId, cancellationToken);
            return Result.Ok(memberships);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tenant memberships for user {UserId}", userId);
            return Result.Fail("Failed to retrieve tenant memberships");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership?>> GetCurrentTenantAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            // First try last-accessed tenant
            UserTenantMembership? membership = await _membershipRepository.GetUserLastAccessedTenantAsync(userId, cancellationToken);

            // Fall back to default tenant
            membership ??= await _membershipRepository.GetUserDefaultTenantAsync(userId, cancellationToken);

            if (membership is null)
            {
                // Fall back to any tenant (first one)
                IEnumerable<UserTenantMembership> allMemberships = await _membershipRepository.GetByUserIdAsync(userId, cancellationToken);
                membership = allMemberships.FirstOrDefault();
            }

            cancellationToken.ThrowIfCancellationRequested();

            return Result.Ok(membership);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current tenant for user {UserId}", userId);
            return Result.Fail("Failed to retrieve current tenant");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IEnumerable<TenantMembershipDto>>> GetUserTenantMembershipDtosAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<IEnumerable<UserTenantMembership>> membershipsResult = await GetUserTenantsAsync(userId, cancellationToken);
            if (membershipsResult.IsFailed)
            {
                return Result.Fail<IEnumerable<TenantMembershipDto>>(membershipsResult.Errors);
            }

            Result<UserTenantMembership?> currentTenantResult = await GetCurrentTenantAsync(userId, cancellationToken);
            Guid? currentTenantId = currentTenantResult.IsSuccess ? currentTenantResult.Value?.TenantId : null;

            IEnumerable<TenantMembershipDto> dtos = [.. membershipsResult.Value.Select(membership => new TenantMembershipDto
            {
                TenantId = membership.TenantId,
                TenantName = membership.Tenant?.TenantName ?? string.Empty,
                DisplayName = membership.Tenant?.DisplayName ?? string.Empty,
                Role = membership.Role,
                IsDefault = membership.IsDefault,
                IsCurrentTenant = membership.TenantId == currentTenantId
            })];

            return Result.Ok(dtos);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tenant membership DTOs for user {UserId}", userId);
            return Result.Fail("Failed to retrieve tenant memberships");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> GetUserTenantMembershipAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            UserTenantMembership? membership = await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);

            if (membership == null)
            {
                _logger.LogWarning("User {UserId} does not belong to tenant {TenantId}", userId, tenantId);
                return Result.Fail(new ForbiddenError("User does not belong to this tenant"));
            }

            return Result.Ok(membership);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting membership for user {UserId} in tenant {TenantId}", userId, tenantId);
            return Result.Fail("Failed to retrieve tenant membership");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> SwitchTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            // Validate user belongs to tenant
            UserTenantMembership? membership = await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);

            if (membership == null)
            {
                _logger.LogWarning("User {UserId} attempted to switch to tenant {TenantId} they don't belong to", userId, tenantId);
                return Result.Fail(new ForbiddenError("User does not belong to this tenant"));
            }

            if (membership.Status != MembershipStatus.Active)
            {
                return Result.Fail(new ForbiddenError("User does not have active access to this tenant"));
            }

            // Update last accessed timestamp
            bool updateSucceeded = await _membershipRepository.UpdateLastAccessedAsync(userId, tenantId, cancellationToken);
            if (!updateSucceeded)
            {
                _logger.LogWarning("User {UserId} membership for tenant {TenantId} disappeared before last-accessed update", userId, tenantId);
                return Result.Fail(new NotFoundError(UserNotMemberOfTenantMessage));
            }

            // Re-fetch to get updated timestamp
            membership = await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);

            _logger.LogInformation("User {UserId} switched to tenant {TenantId} ({TenantName})",
                userId, tenantId, membership?.Tenant?.DisplayName ?? "Unknown");

            return Result.Ok(membership!);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error switching tenant for user {UserId} to tenant {TenantId}", userId, tenantId);
            return Result.Fail("Failed to switch tenant");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> GetLiveMembershipAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            UserTenantMembership? membership =
                await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);
            if (membership is null)
            {
                return Result.Fail(new NotFoundError(UserNotMemberOfTenantMessage));
            }

            return Result.Ok(membership);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting membership for user {UserId} in tenant {TenantId}", userId, tenantId);
            return Result.Fail(new ExceptionalError("Failed to retrieve membership.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<string>> GetUserRoleInTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            UserTenantMembership? membership = await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);

            if (membership == null)
            {
                _logger.LogWarning("User {UserId} does not belong to tenant {TenantId}", userId, tenantId);
                return Result.Fail(new ForbiddenError("User does not belong to this tenant"));
            }

            return Result.Ok(membership.Role);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting role for user {UserId} in tenant {TenantId}", userId, tenantId);
            return Result.Fail("Failed to retrieve user role");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> AddUserToTenantAsync(
        Guid userId,
        Guid tenantId,
        string role,
        bool isDefault = false,
        Guid? addedByUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using TransactionScope transaction = CreateTransactionScope();

            Result<UserTenantMembership> coreResult = await AddUserToTenantCoreAsync(
                userId, tenantId, role, isDefault, addedByUserId, cancellationToken);
            if (coreResult.IsFailed)
            {
                return coreResult;
            }

            transaction.Complete();
            return coreResult;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex) when (PostgresExceptionHelper.IsUniqueViolation(ex))
        {
            return MapAddUniqueViolation(ex, userId, tenantId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding user {UserId} to tenant {TenantId}", userId, tenantId);
            return Result.Fail("Failed to add user to tenant");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> AddUserToTenantWithinTransactionAsync(
        Guid userId,
        Guid tenantId,
        string role,
        bool isDefault = false,
        Guid? addedByUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await AddUserToTenantCoreAsync(
                userId, tenantId, role, isDefault, addedByUserId, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex) when (PostgresExceptionHelper.IsUniqueViolation(ex))
        {
            return MapAddUniqueViolation(ex, userId, tenantId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding user {UserId} to tenant {TenantId}", userId, tenantId);
            return Result.Fail("Failed to add user to tenant");
        }
    }

    private async Task<Result<UserTenantMembership>> AddUserToTenantCoreAsync(
        Guid userId,
        Guid tenantId,
        string role,
        bool isDefault,
        Guid? addedByUserId,
        CancellationToken cancellationToken)
    {
        // Validate role is a valid tenant-scoped role
        if (!ValidTenantRoles.Contains(role))
        {
            _logger.LogWarning("Invalid tenant role {Role} specified for user {UserId} in tenant {TenantId}. Administrator must be assigned via Identity.", role, userId, tenantId);
            return Result.Fail(new BadRequestError($"Invalid tenant role '{role}'. Valid roles are: {string.Join(", ", ValidTenantRoles)}. Note: Administrator is a global role assigned separately."));
        }

        // Check if an active membership already exists
        bool exists = await _membershipRepository.ExistsAsync(userId, tenantId, cancellationToken);
        if (exists)
        {
            _logger.LogWarning("User {UserId} is already a member of tenant {TenantId}", userId, tenantId);
            return Result.Fail(new ConflictError("User is already a member of this tenant"));
        }

        IEnumerable<UserTenantMembership> existingMemberships = await _membershipRepository.GetByUserIdAsync(userId, cancellationToken);
        bool hasExistingMemberships = existingMemberships.Any();
        bool shouldBeDefault = !hasExistingMemberships || isDefault;

        if (hasExistingMemberships && shouldBeDefault)
        {
            await ClearExistingDefaultMembershipAsync(userId, null, addedByUserId, cancellationToken);
        }

        // Soft-deleted rows: within the reinstatement window, reactivate the same row
        // (role/history intact). Outside the window, fall through to insert a fresh row —
        // the partial unique index (DeletedOn IS NULL) permits one live + one ended row.
        UserTenantMembership? softDeletedMembership =
            await _membershipRepository.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, cancellationToken);
        if (softDeletedMembership is not null)
        {
            Result windowCheck = EnsureWithinReinstatementWindow(softDeletedMembership);
            if (windowCheck.IsSuccess)
            {
                // Keep the prior role on reinstatement; invite accept uses DefaultInviteRole
                // only when inserting a fresh membership row outside the window.
                if (!string.Equals(softDeletedMembership.Role, role, StringComparison.Ordinal))
                {
                    _logger.LogWarning(
                        "Reinstating user {UserId} in tenant {TenantId} with prior role {RestoredRole}; requested role {RequestedRole} was ignored",
                        userId,
                        tenantId,
                        softDeletedMembership.Role,
                        role);
                }

                softDeletedMembership.Status = MembershipStatus.Active;
                softDeletedMembership.IsDefault = shouldBeDefault;
                softDeletedMembership.DeletedOn = null;
                softDeletedMembership.DeletedBy = null;
                softDeletedMembership.JoinedAt = DateTime.UtcNow;
                softDeletedMembership.ModifiedBy = addedByUserId;
                softDeletedMembership.LastAccessedAt = null;

                await _membershipRepository.UpdateAsync(softDeletedMembership, cancellationToken);

                _logger.LogInformation(
                    "User {UserId} re-added to tenant {TenantId} with role {Role} by user {AddedBy} (reactivated soft-deleted membership)",
                    userId,
                    tenantId,
                    softDeletedMembership.Role,
                    addedByUserId?.ToString() ?? "system");

                return Result.Ok(softDeletedMembership);
            }

            _logger.LogInformation(
                "Reinstatement window expired for user {UserId} in tenant {TenantId}; inserting a new membership row",
                userId,
                tenantId);
        }

        UserTenantMembership membership = new UserTenantMembership
        {
            UserId = userId,
            TenantId = tenantId,
            Role = role,
            Status = MembershipStatus.Active,
            IsDefault = shouldBeDefault,
            CreatedBy = addedByUserId
        };

        UserTenantMembership created = await _membershipRepository.AddAsync(membership, cancellationToken);

        _logger.LogInformation("User {UserId} added to tenant {TenantId} with role {Role} by user {AddedBy}",
            userId, tenantId, role, addedByUserId?.ToString() ?? "system");

        return Result.Ok(created);
    }

    private Result<UserTenantMembership> MapAddUniqueViolation(Exception ex, Guid userId, Guid tenantId)
    {
        PostgresExceptionHelper.TryGetUniqueViolationConstraintName(ex, out string? constraintName);

        _logger.LogWarning(
            ex,
            "Unique constraint {ConstraintName} violated adding user {UserId} to tenant {TenantId}",
            constraintName ?? "(unknown)",
            userId,
            tenantId);

        if (string.Equals(
                constraintName,
                IndexNames.UserTenantMembershipsUserIdIsDefault,
                StringComparison.Ordinal))
        {
            return Result.Fail(new ConflictError("User already has a default tenant membership."));
        }

        // Membership (UserId, TenantId) race, or unknown unique violation — keep 409.
        return Result.Fail(new ConflictError("User is already a member of this tenant"));
    }

    /// <inheritdoc/>
    public async Task<Result<IReadOnlyList<RemovedTenantMemberDto>>> GetRemovedMembersAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<UserTenantMembership> memberships =
                await _membershipRepository.GetSoftDeletedByTenantIdAsync(tenantId, cancellationToken);

            HashSet<string> pendingInviteEmails = (await _tenantInviteRepository
                    .GetPendingByTenantAsync(tenantId, cancellationToken))
                .Select(invite => invite.NormalizedEmail)
                .ToHashSet(StringComparer.Ordinal);

            // Recovery UI only: omit retired/anonymized tombstones and anyone who already
            // has a pending restore/invite for this tenant.
            List<RemovedTenantMemberDto> results = memberships
                .Where(m => m.User is not null
                    && m.DeletedOn is not null
                    && m.User.DeletedOn is null
                    && (m.User.NormalizedEmail is null
                        || !pendingInviteEmails.Contains(m.User.NormalizedEmail)))
                .Select(m => new RemovedTenantMemberDto
                {
                    UserId = m.UserId,
                    Email = m.User!.Email ?? string.Empty,
                    FirstName = m.User.FirstName,
                    LastName = m.User.LastName,
                    Role = m.Role,
                    RemovedOn = m.DeletedOn!.Value,
                    RemovedBy = m.DeletedBy,
                })
                .ToList();

            return Result.Ok<IReadOnlyList<RemovedTenantMemberDto>>(results);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing removed members for tenant {TenantId}", tenantId);
            return Result.Fail(new ExceptionalError("Failed to list removed members.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> RestoreMembershipAsync(
        Guid userId,
        Guid tenantId,
        Guid restoredByUserId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using TransactionScope transaction = CreateTransactionScope();

            bool exists = await _membershipRepository.ExistsAsync(userId, tenantId, cancellationToken);
            if (exists)
            {
                return Result.Fail(new ConflictError("User is already a member of this tenant"));
            }

            UserTenantMembership? membership =
                await _membershipRepository.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, cancellationToken);
            if (membership is null)
            {
                return Result.Fail(new NotFoundError("No removed membership found for this user in the current tenant."));
            }

            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is null)
            {
                return Result.Fail(new NotFoundError($"User with ID {userId} not found"));
            }

            if (user.DeletedOn is not null)
            {
                return Result.Fail(new ConflictError(
                    "This user's account is retired. Restore the account from platform administration before restoring membership."));
            }

            Result windowCheck = EnsureWithinReinstatementWindow(membership);
            if (windowCheck.IsFailed)
            {
                return Result.Fail<UserTenantMembership>(windowCheck.Errors);
            }

            membership.DeletedOn = null;
            membership.DeletedBy = null;
            membership.Status = MembershipStatus.Active;
            membership.ModifiedBy = restoredByUserId;
            membership.ModifiedOn = DateTime.UtcNow;

            await _membershipRepository.UpdateAsync(membership, cancellationToken);

            Result auditResult = await _auditLogService.LogActionAsync(
                AuditIp,
                AuditUserAgent,
                ActionTypeMembershipRestore,
                tenantId,
                restoredByUserId,
                EntityTypeMembership,
                userId.ToString(),
                AuditSeverities.Info,
                metadata: null);
            if (auditResult.IsFailed)
            {
                return Result.Fail<UserTenantMembership>(auditResult.Errors);
            }

            transaction.Complete();

            _logger.LogInformation(
                "Membership for user {UserId} restored in tenant {TenantId} with role {Role} by {RestoredBy}",
                userId,
                tenantId,
                membership.Role,
                restoredByUserId);

            return Result.Ok(membership);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring membership for user {UserId} in tenant {TenantId}", userId, tenantId);
            return Result.Fail(new ExceptionalError("Failed to restore membership.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IReadOnlyList<Guid>>> EndAllLiveMembershipsForPlatformRetirementAsync(
        Guid userId,
        Guid performedByUserId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<UserTenantMembership> liveMemberships =
                await _membershipRepository.GetLiveByUserIdAsync(userId, cancellationToken);
            List<Guid> tenantIds = [];

            foreach (UserTenantMembership membership in liveMemberships)
            {
                string priorRole = membership.Role;
                Guid tenantId = membership.TenantId;

                SubscriptionSeat? seat = await _subscriptionSeatRepository.GetByUserAsync(
                    tenantId,
                    userId,
                    cancellationToken);
                Guid? seatId = seat?.UserId == userId ? seat.SubscriptionSeatId : null;

                await ReleaseSeatAssignmentAsync(
                    tenantId,
                    userId,
                    performedByUserId,
                    cancellationToken);

                Result removeResult = await RemoveUserFromTenantWithinTransactionAsync(
                    userId,
                    tenantId,
                    performedByUserId,
                    cancellationToken);
                if (removeResult.IsFailed)
                {
                    return Result.Fail(removeResult.Errors);
                }

                string metadataJson = System.Text.Json.JsonSerializer.Serialize(new
                {
                    priorRole,
                    seatId,
                    removedUserId = userId,
                    reason = "platform-retirement",
                });

                Result auditResult = await _auditLogService.LogActionAsync(
                    AuditIp,
                    AuditUserAgent,
                    ActionTypeMembershipEnd,
                    tenantId,
                    performedByUserId,
                    EntityTypeMembership,
                    userId.ToString(),
                    AuditSeverities.Info,
                    metadata: metadataJson);
                if (auditResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Platform retirement for user {UserId} in tenant {TenantId} rolled back because audit write failed: {Errors}",
                        userId,
                        tenantId,
                        string.Join(", ", auditResult.Errors.Select(error => error.Message)));
                    return Result.Fail(auditResult.Errors);
                }

                tenantIds.Add(tenantId);
            }

            return Result.Ok<IReadOnlyList<Guid>>(tenantIds);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending live memberships for platform retirement of user {UserId}", userId);
            return Result.Fail(new ExceptionalError("Failed to end memberships during account retirement.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> RemoveUserFromTenantAsync(
        Guid userId,
        Guid tenantId,
        Guid? deletedByUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using TransactionScope transaction = CreateTransactionScope();

            Result coreResult = await RemoveUserFromTenantCoreAsync(
                userId, tenantId, deletedByUserId, cancellationToken);
            if (coreResult.IsFailed)
            {
                return coreResult;
            }

            transaction.Complete();
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing user {UserId} from tenant {TenantId}", userId, tenantId);
            return Result.Fail(new BadRequestError("Failed to remove user from tenant"));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> RemoveUserFromTenantWithinTransactionAsync(
        Guid userId,
        Guid tenantId,
        Guid? deletedByUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await RemoveUserFromTenantCoreAsync(userId, tenantId, deletedByUserId, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing user {UserId} from tenant {TenantId}", userId, tenantId);
            return Result.Fail(new BadRequestError("Failed to remove user from tenant"));
        }
    }

    private async Task<Result> RemoveUserFromTenantCoreAsync(
        Guid userId,
        Guid tenantId,
        Guid? deletedByUserId,
        CancellationToken cancellationToken)
    {
        UserTenantMembership? membership = await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);
        if (membership == null)
        {
            _logger.LogWarning("User {UserId} is not a member of tenant {TenantId}", userId, tenantId);
            return Result.Fail(new NotFoundError(UserNotMemberOfTenantMessage));
        }

        bool wasDefaultMembership = membership.IsDefault;

        bool removed = await _membershipRepository.RemoveAsync(
            userId, tenantId, deletedByUserId, cancellationToken);

        if (!removed)
        {
            _logger.LogWarning("User {UserId} is not a member of tenant {TenantId}", userId, tenantId);
            return Result.Fail(new NotFoundError(UserNotMemberOfTenantMessage));
        }

        if (wasDefaultMembership)
        {
            await PromoteEarliestJoinedMembershipToDefaultAsync(userId, null, cancellationToken);
        }

        _logger.LogInformation("User {UserId} removed from tenant {TenantId}", userId, tenantId);
        return Result.Ok();
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> UpdateUserRoleInTenantAsync(
        Guid userId,
        Guid tenantId,
        string newRole,
        Guid? updatedByUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Validate role
            if (!ValidTenantRoles.Contains(newRole))
            {
                return Result.Fail(new BadRequestError($"Invalid tenant role '{newRole}'. Valid roles are: {string.Join(", ", ValidTenantRoles)}"));
            }

            UserTenantMembership? membership = await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);

            if (membership == null)
            {
                return Result.Fail(new NotFoundError(UserNotMemberOfTenantMessage));
            }

            // Need to get a tracked entity for update
            // The repository returns AsNoTracking, so we need to update via the repository
            membership.Role = newRole;
            membership.ModifiedBy = updatedByUserId;

            await _membershipRepository.UpdateAsync(membership, cancellationToken);

            _logger.LogInformation("User {UserId} role updated to {NewRole} in tenant {TenantId} by user {UpdatedBy}",
                userId, newRole, tenantId, updatedByUserId?.ToString() ?? "system");

            // Re-fetch to ensure we have the updated data
            UserTenantMembership? updated = await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);
            return Result.Ok(updated!);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating role for user {UserId} in tenant {TenantId}", userId, tenantId);
            return Result.Fail("Failed to update user role");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> SetDefaultTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            using TransactionScope transaction = CreateTransactionScope();

            UserTenantMembership? membership = await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);
            if (membership == null)
            {
                return Result.Fail(new NotFoundError(UserNotMemberOfTenantMessage));
            }

            if (membership.IsDefault)
            {
                // Complete even on no-op so a nested ambient scope is not aborted on dispose.
                transaction.Complete();
                return Result.Ok();
            }

            await ClearExistingDefaultMembershipAsync(userId, membership.Id, userId, cancellationToken);

            membership.IsDefault = true;
            membership.ModifiedBy = userId;
            await _membershipRepository.UpdateAsync(membership, cancellationToken);

            transaction.Complete();

            _logger.LogInformation("Default tenant set to {TenantId} for user {UserId}", tenantId, userId);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting default tenant {TenantId} for user {UserId}", tenantId, userId);
            return Result.Fail("Failed to set default tenant");
        }
    }

    private async Task ClearExistingDefaultMembershipAsync(
        Guid userId,
        int? membershipIdToKeepDefault,
        Guid? modifiedByUserId,
        CancellationToken cancellationToken)
    {
        UserTenantMembership? previousDefaultMembership = await _membershipRepository.GetUserDefaultTenantAsync(userId, cancellationToken);

        if (previousDefaultMembership == null)
        {
            return;
        }

        if (membershipIdToKeepDefault.HasValue && previousDefaultMembership.Id == membershipIdToKeepDefault.Value)
        {
            return;
        }

        previousDefaultMembership.IsDefault = false;
        previousDefaultMembership.ModifiedBy = modifiedByUserId;
        await _membershipRepository.UpdateAsync(previousDefaultMembership, cancellationToken);
    }

    private static TransactionScope CreateTransactionScope()
    {
        return new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);
    }

    private async Task PromoteEarliestJoinedMembershipToDefaultAsync(
        Guid userId,
        Guid? modifiedByUserId,
        CancellationToken cancellationToken)
    {
        IEnumerable<UserTenantMembership> remainingMemberships = await _membershipRepository.GetByUserIdAsync(userId, cancellationToken);

        UserTenantMembership? nextDefaultMembership = remainingMemberships
            .OrderBy(membership => membership.JoinedAt)
            .FirstOrDefault();

        if (nextDefaultMembership == null || nextDefaultMembership.IsDefault)
        {
            return;
        }

        nextDefaultMembership.IsDefault = true;
        nextDefaultMembership.ModifiedBy = modifiedByUserId;
        await _membershipRepository.UpdateAsync(nextDefaultMembership, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> UserBelongsToTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _membershipRepository.ExistsActiveAsync(userId, tenantId, cancellationToken);
    }

    /// <inheritdoc/>
    public Task<bool> HasLiveMembershipAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return _membershipRepository.HasLiveMembershipAsync(userId, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> SuspendMembershipAsync(
        Guid userId,
        Guid tenantId,
        Guid suspendedByUserId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            UserTenantMembership membership;
            using (TransactionScope transaction = CreateTransactionScope())
            {
                UserTenantMembership? existing =
                    await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);
                if (existing is null)
                {
                    return Result.Fail(new NotFoundError(UserNotMemberOfTenantMessage));
                }

                if (existing.Status == MembershipStatus.Suspended)
                {
                    // Complete even on no-op so a nested ambient scope is not aborted on dispose.
                    transaction.Complete();
                    return Result.Ok(existing);
                }

                if (existing.Status != MembershipStatus.Active)
                {
                    return Result.Fail(new BadRequestError("Only an active membership can be suspended."));
                }

                await ReleaseSeatAssignmentAsync(tenantId, userId, suspendedByUserId, cancellationToken);

                existing.Status = MembershipStatus.Suspended;
                existing.IsDefault = false;
                existing.ModifiedBy = suspendedByUserId;
                existing.ModifiedOn = DateTime.UtcNow;
                await _membershipRepository.UpdateAsync(existing, cancellationToken);

                await PromoteEarliestJoinedMembershipToDefaultAsync(userId, suspendedByUserId, cancellationToken);

                Result auditResult = await _auditLogService.LogActionAsync(
                    AuditIp,
                    AuditUserAgent,
                    ActionTypeMembershipSuspend,
                    tenantId,
                    suspendedByUserId,
                    EntityTypeMembership,
                    userId.ToString(),
                    AuditSeverities.Info,
                    metadata: null);
                if (auditResult.IsFailed)
                {
                    return Result.Fail(auditResult.Errors);
                }

                membership = existing;
                transaction.Complete();
            }

            await _tenantAccessRevocationService.RevokeAsync(userId, tenantId, cancellationToken);

            _logger.LogInformation(
                "Membership for user {UserId} suspended in tenant {TenantId} by {SuspendedBy}",
                userId,
                tenantId,
                suspendedByUserId);
            return Result.Ok(membership);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error suspending membership for user {UserId} in tenant {TenantId}", userId, tenantId);
            return Result.Fail(new ExceptionalError("Failed to suspend membership.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UserTenantMembership>> ResumeMembershipAsync(
        Guid userId,
        Guid tenantId,
        Guid resumedByUserId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using TransactionScope transaction = CreateTransactionScope();

            UserTenantMembership? membership =
                await _membershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);
            if (membership is null)
            {
                return Result.Fail(new NotFoundError(UserNotMemberOfTenantMessage));
            }

            if (membership.Status == MembershipStatus.Active)
            {
                // Complete even on no-op so a nested ambient scope is not aborted on dispose.
                transaction.Complete();
                return Result.Ok(membership);
            }

            if (membership.Status != MembershipStatus.Suspended)
            {
                return Result.Fail(new BadRequestError("Only a suspended membership can be resumed."));
            }

            membership.Status = MembershipStatus.Active;
            membership.ModifiedBy = resumedByUserId;
            membership.ModifiedOn = DateTime.UtcNow;
            await _membershipRepository.UpdateAsync(membership, cancellationToken);

            // Re-establish a home pointer if suspension left the user without a default.
            UserTenantMembership? currentDefault =
                await _membershipRepository.GetUserDefaultTenantAsync(userId, cancellationToken);
            if (currentDefault is null)
            {
                membership.IsDefault = true;
                await _membershipRepository.UpdateAsync(membership, cancellationToken);
            }

            Result auditResult = await _auditLogService.LogActionAsync(
                AuditIp,
                AuditUserAgent,
                ActionTypeMembershipResume,
                tenantId,
                resumedByUserId,
                EntityTypeMembership,
                userId.ToString(),
                AuditSeverities.Info,
                metadata: null);
            if (auditResult.IsFailed)
            {
                return Result.Fail(auditResult.Errors);
            }

            transaction.Complete();
            _logger.LogInformation(
                "Membership for user {UserId} resumed in tenant {TenantId} by {ResumedBy}",
                userId,
                tenantId,
                resumedByUserId);
            return Result.Ok(membership);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resuming membership for user {UserId} in tenant {TenantId}", userId, tenantId);
            return Result.Fail(new ExceptionalError("Failed to resume membership.", ex));
        }
    }

    /// <inheritdoc/>
    public Result EnsureWithinReinstatementWindow(UserTenantMembership membership)
    {
        return MembershipReinstatementPolicy.EnsureWithinWindow(
            membership,
            _accountLifecycleOptions.Value.MembershipReinstatementDays);
    }

    private async Task ReleaseSeatAssignmentAsync(
        Guid tenantId,
        Guid userId,
        Guid releasedByUserId,
        CancellationToken cancellationToken)
    {
        SubscriptionSeat? seat = await _subscriptionSeatRepository.GetByUserAsync(tenantId, userId, cancellationToken);
        if (seat is null || seat.UserId != userId)
        {
            return;
        }

        SubscriptionSeatAssignment.Clear(seat);
        seat.ModifiedBy = releasedByUserId;
        seat.ModifiedOn = DateTime.UtcNow;

        await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);
    }
}
