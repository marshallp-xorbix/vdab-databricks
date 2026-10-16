using System.Text.Json;
using System.Transactions;
using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for user account lifecycle operations.
/// </summary>
public class UserLifecycleService : IUserLifecycleService
{
    private const string AuditUserAgent = "UserLifecycleService";
    private const string AuditIp = "internal-service";
    private const string EntityTypeUser = "User";
    private const string ActionTypeUserPurge = "UserPurge";
    private const string ActionTypeUserRestore = "UserRestore";
    private const string ActionTypeUserAnonymize = "UserAnonymize";

    private readonly ILogger<UserLifecycleService> _logger;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserRepository _userRepository;
    private readonly IAppRepository _appRepository;
    private readonly IDatabricksConnectionRepository _connectionRepository;
    private readonly ITenantAiModelRepository _tenantAiModelRepository;
    private readonly IUserTenantMembershipRepository _membershipRepository;
    private readonly IUserTenantPreferenceRepository _preferenceRepository;
    private readonly ISubscriptionSeatRepository _seatRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IUserPlatformAiUsageRepository _platformAiUsageRepository;
    private readonly IDatabricksUserTokenRepository _databricksUserTokenRepository;
    private readonly IAuditLogRepository _auditLogRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IAuditLogService _auditLogService;
    private readonly IOptions<AccountLifecycleConfiguration> _accountLifecycleOptions;

    /// <summary>
    /// Initializes a new instance of the <see cref="UserLifecycleService"/> class.
    /// </summary>
    public UserLifecycleService(
        ILogger<UserLifecycleService> logger,
        UserManager<ApplicationUser> userManager,
        IUserRepository userRepository,
        IAppRepository appRepository,
        IDatabricksConnectionRepository connectionRepository,
        ITenantAiModelRepository tenantAiModelRepository,
        IUserTenantMembershipRepository membershipRepository,
        IUserTenantPreferenceRepository preferenceRepository,
        ISubscriptionSeatRepository seatRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IUserPlatformAiUsageRepository platformAiUsageRepository,
        IDatabricksUserTokenRepository databricksUserTokenRepository,
        IAuditLogRepository auditLogRepository,
        ITenantRepository tenantRepository,
        IAuditLogService auditLogService,
        IOptions<AccountLifecycleConfiguration> accountLifecycleOptions)
    {
        _logger = logger;
        _userManager = userManager;
        _userRepository = userRepository;
        _appRepository = appRepository;
        _connectionRepository = connectionRepository;
        _tenantAiModelRepository = tenantAiModelRepository;
        _membershipRepository = membershipRepository;
        _preferenceRepository = preferenceRepository;
        _seatRepository = seatRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _platformAiUsageRepository = platformAiUsageRepository;
        _databricksUserTokenRepository = databricksUserTokenRepository;
        _auditLogRepository = auditLogRepository;
        _tenantRepository = tenantRepository;
        _auditLogService = auditLogService;
        _accountLifecycleOptions = accountLifecycleOptions;
    }

    /// <inheritdoc/>
    public async Task<Result> DeactivateUserAsync(Guid userId, Guid deactivatedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found", userId);
                return Result.Fail($"User with ID {userId} not found");
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("User {UserId} is already inactive", userId);
                return Result.Fail("User is already inactive");
            }

            user.IsActive = false;
            user.ModifiedOn = DateTime.UtcNow;
            user.ModifiedBy = deactivatedByUserId;

            IdentityResult result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                string errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to deactivate user {UserId}: {Errors}", userId, errors);
                return Result.Fail($"Failed to deactivate user: {errors}");
            }

            _logger.LogInformation("User {UserId} deactivated successfully", userId);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deactivating user with ID {UserId}", userId);
            return Result.Fail($"Error deactivating user: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> LockUserAsync(Guid userId, Guid lockedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Attempted to lock non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError("User not found"));
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("Attempted to lock inactive user {UserId}", userId);
                return Result.Fail("Cannot lock inactive user");
            }

            IdentityResult result = await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue);
            if (result.Succeeded)
            {
                user.ModifiedOn = DateTime.UtcNow;
                user.ModifiedBy = lockedByUserId;
                await _userManager.UpdateAsync(user);
            }

            if (!result.Succeeded)
            {
                string errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to lock user {UserId}: {Errors}", userId, errors);
                return Result.Fail($"Failed to lock user: {errors}");
            }

            _logger.LogInformation("User {UserId} ({Email}) locked successfully", userId, user.Email);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error locking user {UserId}", userId);
            return Result.Fail($"Failed to lock user: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> UnlockUserAsync(Guid userId, Guid unlockedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Attempted to unlock non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError("User not found"));
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("Attempted to unlock inactive user {UserId}", userId);
                return Result.Fail("Cannot unlock inactive user");
            }

            IdentityResult result = await _userManager.SetLockoutEndDateAsync(user, null);
            if (result.Succeeded)
            {
                user.ModifiedOn = DateTime.UtcNow;
                user.ModifiedBy = unlockedByUserId;
                await _userManager.UpdateAsync(user);
            }

            if (!result.Succeeded)
            {
                string errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to unlock user {UserId}: {Errors}", userId, errors);
                return Result.Fail($"Failed to unlock user: {errors}");
            }

            _logger.LogInformation("User {UserId} ({Email}) unlocked successfully", userId, user.Email);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unlocking user {UserId}", userId);
            return Result.Fail($"Failed to unlock user: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ReactivateUserAsync(Guid userId, Guid reactivatedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found", userId);
                return Result.Fail(new NotFoundError($"User with ID {userId} not found"));
            }

            bool isTombstoned = user.DeletedOn is not null;
            if (user.IsActive && !isTombstoned)
            {
                _logger.LogWarning("User {UserId} is already active", userId);
                return Result.Fail(new BadRequestError("User is already active"));
            }

            using TransactionScope transaction = new(
                TransactionScopeOption.Required,
                TransactionScopeAsyncFlowOption.Enabled);

            user.IsActive = true;
            user.DeletedOn = null;
            user.DeletedBy = null;
            user.RetirementReason = null;
            user.ModifiedOn = DateTime.UtcNow;
            user.ModifiedBy = reactivatedByUserId;

            IdentityResult result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                string errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to restore user {UserId}: {Errors}", userId, errors);
                bool isDuplicate = result.Errors.Any(error =>
                    error.Code.Contains("Duplicate", StringComparison.OrdinalIgnoreCase)
                    || error.Description.Contains("already taken", StringComparison.OrdinalIgnoreCase));
                if (isDuplicate)
                {
                    return Result.Fail(new ConflictError("Cannot restore user: email or username is already in use by another account."));
                }

                return Result.Fail(new BadRequestError("Failed to restore user."));
            }

            Result auditResult = await _auditLogService.LogActionAsync(
                AuditIp,
                AuditUserAgent,
                ActionTypeUserRestore,
                user.TenantId,
                reactivatedByUserId,
                EntityTypeUser,
                userId.ToString(),
                AuditSeverities.Info,
                metadata: null);
            if (auditResult.IsFailed)
            {
                _logger.LogWarning(
                    "User {UserId} restore aborted because audit write failed: {Errors}",
                    userId,
                    string.Join(", ", auditResult.Errors.Select(error => error.Message)));
                return Result.Fail(auditResult.Errors);
            }

            transaction.Complete();

            _logger.LogInformation("User {UserId} restored successfully by {RestoredByUserId}", userId, reactivatedByUserId);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring user with ID {UserId}", userId);
            return Result.Fail(new ExceptionalError("Error restoring user.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> PurgeUserDataAsync(Guid userId, Guid deletedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (userId == deletedByUserId)
            {
                return Result.Fail(new BadRequestError("You cannot purge your own user account."));
            }

            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Purge attempted for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError($"User with ID {userId} not found"));
            }

            Result soleAdminGuard = await EnsureNotSoleGlobalAdministratorAsync(user, cancellationToken);
            if (soleAdminGuard.IsFailed)
            {
                return soleAdminGuard;
            }

            UserPurgeCascadeCounts cascade;
            using (TransactionScope transaction = new(
                TransactionScopeOption.Required,
                TransactionScopeAsyncFlowOption.Enabled))
            {
                cascade = await HardDeleteUserCascadeAsync(userId, cancellationToken);

                IdentityResult deleteResult = await _userManager.DeleteAsync(user);
                if (!deleteResult.Succeeded)
                {
                    string errors = string.Join(", ", deleteResult.Errors.Select(e => e.Description));
                    _logger.LogWarning("Failed to delete Identity user {UserId}: {Errors}", userId, errors);
                    return Result.Fail($"Failed to purge user: {errors}");
                }

                transaction.Complete();
            }

            // Post-commit tombstone: tenantId null so it survives without a live Tenant FK.
            await WriteUserPurgeAuditAsync(userId, deletedByUserId, cascade);

            _logger.LogWarning(
                "User {UserId} purged by {DeletedByUserId}. Cascade: {Apps} apps, {AiModels} AI models, {Connections} connections, {Memberships} memberships, {Preferences} preferences, {Seats} seats, {RefreshTokens} refresh tokens, {PlatformAiUsage} AI usage rows, {DatabricksTokens} Databricks tokens, {AuditLogs} audit logs, {ClearedTenantOwners} tenant owner refs cleared.",
                userId,
                deletedByUserId,
                cascade.Apps,
                cascade.AiModels,
                cascade.Connections,
                cascade.Memberships,
                cascade.Preferences,
                cascade.Seats,
                cascade.RefreshTokens,
                cascade.PlatformAiUsage,
                cascade.DatabricksTokens,
                cascade.AuditLogs,
                cascade.ClearedTenantOwners);

            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error purging user {UserId}", userId);
            return Result.Fail($"Error purging user: {ex.Message}");
        }
    }

    private async Task WriteUserPurgeAuditAsync(
        Guid purgedUserId,
        Guid deletedByUserId,
        UserPurgeCascadeCounts cascade)
    {
        try
        {
            string metadataJson = JsonSerializer.Serialize(new
            {
                purgedUserId,
                cascade
            });

            Result result = await _auditLogService.LogActionAsync(
                ipAddress: AuditIp,
                userAgent: AuditUserAgent,
                actionType: ActionTypeUserPurge,
                tenantId: null,
                userId: deletedByUserId,
                entityType: EntityTypeUser,
                entityId: purgedUserId.ToString(),
                severity: AuditSeverities.Warning,
                metadata: metadataJson);

            if (result.IsFailed)
            {
                _logger.LogWarning(
                    "Failed to write UserPurge audit for user {UserId}: {Errors}",
                    purgedUserId,
                    string.Join("; ", result.Errors.Select(e => e.Message)));
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "UserPurge audit write threw for user {UserId}", purgedUserId);
        }
    }

    private async Task<UserPurgeCascadeCounts> HardDeleteUserCascadeAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        // Restrict FKs: Apps → Connection / Owner, TenantAiModels → Connection, Connection → Owner.
        IReadOnlyList<int> ownedConnectionIds =
            await _connectionRepository.GetIdsByOwnerAsync(userId, cancellationToken);
        int apps = await _appRepository.HardDeleteForUserPurgeAsync(
            userId,
            ownedConnectionIds,
            cancellationToken);
        int aiModels = await _tenantAiModelRepository.HardDeleteByConnectionIdsAsync(
            ownedConnectionIds,
            cancellationToken);
        int connections = await _connectionRepository.HardDeleteByOwnerAsync(userId, cancellationToken);

        int memberships = await _membershipRepository.HardDeleteAllForUserAsync(userId, cancellationToken);
        int preferences = await _preferenceRepository.HardDeleteByUserAsync(userId, cancellationToken);
        // Unassign seats (SetNull intent) so tenant paid allocation stays in sync with Stripe.
        int seats = await _seatRepository.UnassignByUserAsync(userId, cancellationToken);
        int refreshTokens = await _refreshTokenRepository.HardDeleteByUserAsync(userId, cancellationToken);
        int platformAiUsage = await _platformAiUsageRepository.HardDeleteByUserAsync(userId, cancellationToken);
        int databricksTokens = await _databricksUserTokenRepository.HardDeleteByUserAsync(userId, cancellationToken);
        int auditLogs = await _auditLogRepository.HardDeleteByUserAsync(userId, cancellationToken);
        int clearedTenantOwners = await _tenantRepository.ClearOwnerIdForUserAsync(userId, cancellationToken);

        return new UserPurgeCascadeCounts(
            Apps: apps,
            AiModels: aiModels,
            Connections: connections,
            Memberships: memberships,
            Preferences: preferences,
            Seats: seats,
            RefreshTokens: refreshTokens,
            PlatformAiUsage: platformAiUsage,
            DatabricksTokens: databricksTokens,
            AuditLogs: auditLogs,
            ClearedTenantOwners: clearedTenantOwners);
    }

    private sealed record UserPurgeCascadeCounts(
        int Apps,
        int AiModels,
        int Connections,
        int Memberships,
        int Preferences,
        int Seats,
        int RefreshTokens,
        int PlatformAiUsage,
        int DatabricksTokens,
        int AuditLogs,
        int ClearedTenantOwners);

    private async Task<Result> EnsureNotSoleGlobalAdministratorAsync(
        ApplicationUser user,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        bool isAdministrator = await _userManager.IsInRoleAsync(user, AuthRoles.Administrator);
        if (!isAdministrator)
        {
            return Result.Ok();
        }

        IList<ApplicationUser> administrators =
            await _userManager.GetUsersInRoleAsync(AuthRoles.Administrator);

        int remainingAdministrators = administrators.Count(admin => admin.Id != user.Id);
        if (remainingAdministrators == 0)
        {
            return Result.Fail(new ConflictError(
                "Cannot purge the sole Global Administrator. Assign another Administrator first."));
        }

        return Result.Ok();
    }

    /// <inheritdoc/>
    public async Task<Result> TryAnonymizeStaleRetiredByEmailAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        try
        {
            int? anonymizationDays = _accountLifecycleOptions.Value.RetiredAnonymizationDays;
            if (anonymizationDays is null or <= 0)
            {
                return Result.Ok();
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                return Result.Ok();
            }

            string normalizedEmail = _userManager.NormalizeEmail(email);
            if (string.IsNullOrEmpty(normalizedEmail))
            {
                return Result.Ok();
            }

            IReadOnlyList<ApplicationUser> retired =
                await _userRepository.GetRetiredByNormalizedEmailAsync(normalizedEmail, cancellationToken);
            if (retired.Count == 0)
            {
                return Result.Ok();
            }

            DateTime cutoff = DateTime.UtcNow.AddDays(-anonymizationDays.Value);
            foreach (ApplicationUser candidate in retired)
            {
                if (candidate.DeletedOn is not DateTime deletedOn || deletedOn > cutoff)
                {
                    continue;
                }

                Result anonymizeResult = await AnonymizeRetiredUserAsync(candidate.Id, cancellationToken);
                if (anonymizeResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Failed to anonymize stale retired user {UserId}: {Errors}",
                        candidate.Id,
                        string.Join("; ", anonymizeResult.Errors.Select(e => e.Message)));
                }
            }

            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lazy anonymization failed for email {Email}", email);
            return Result.Fail(new ExceptionalError("Lazy anonymization failed.", ex));
        }
    }

    private async Task<Result> AnonymizeRetiredUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Fail(new NotFoundError($"User with ID {userId} not found"));
        }

        if (user.DeletedOn is null)
        {
            return Result.Fail(new BadRequestError("Only retired accounts can be anonymized."));
        }

        if (user.AnonymizedOn is not null)
        {
            return Result.Ok();
        }

        using TransactionScope transaction = new(
            TransactionScopeOption.Required,
            TransactionScopeAsyncFlowOption.Enabled);

        ApplyAnonymizedIdentity(user, userId);

        IdentityResult updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            string errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
            _logger.LogWarning("Failed to anonymize user {UserId}: {Errors}", userId, errors);
            return Result.Fail(new BadRequestError("Failed to anonymize retired user."));
        }

        Result auditResult = await _auditLogService.LogActionAsync(
            AuditIp,
            AuditUserAgent,
            ActionTypeUserAnonymize,
            tenantId: null,
            userId: null,
            EntityTypeUser,
            userId.ToString(),
            AuditSeverities.Info,
            metadata: null);
        if (auditResult.IsFailed)
        {
            return Result.Fail(auditResult.Errors);
        }

        transaction.Complete();

        _logger.LogInformation("Anonymized retired user {UserId}", userId);
        return Result.Ok();
    }

    private void ApplyAnonymizedIdentity(ApplicationUser user, Guid userId)
    {
        string anonymizedEmail = RetiredUserAnonymization.FormatEmail(userId);
        string normalized = _userManager.NormalizeEmail(anonymizedEmail) ?? anonymizedEmail.ToUpperInvariant();

        user.Email = anonymizedEmail;
        user.NormalizedEmail = normalized;
        user.UserName = anonymizedEmail;
        user.NormalizedUserName = normalized;
        user.FirstName = RetiredUserAnonymization.FirstName;
        user.LastName = RetiredUserAnonymization.LastName;
        user.PhoneNumber = null;
        user.AzureAdObjectId = null;
        user.AnonymizedOn = DateTime.UtcNow;
        user.ModifiedOn = DateTime.UtcNow;
        user.ModifiedBy = null;
    }
}
