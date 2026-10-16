using System.Text.Json;
using System.Transactions;
using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Implements administrator-facing tenant lifecycle operations.
/// </summary>
public class TenantLifecycleService : ITenantLifecycleService
{
    private const string AuditUserAgent = "TenantLifecycleService";
    private const string AuditIp = "internal-service";
    private const string EntityTypeTenant = "Tenant";

    private readonly ILogger<TenantLifecycleService> _logger;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITenantRepository _tenantRepository;
    private readonly IUserTenantMembershipRepository _membershipRepository;
    private readonly IAppRepository _appRepository;
    private readonly IDatabricksConnectionRepository _connectionRepository;
    private readonly ISubscriptionSeatRepository _seatRepository;
    private readonly ITenantInviteRepository _inviteRepository;
    private readonly ITenantAiModelRepository _tenantAiModelRepository;
    private readonly IUserTenantPreferenceRepository _preferenceRepository;
    private readonly ISubscriptionHistoryRepository _subscriptionHistoryRepository;
    private readonly IAuditLogRepository _auditLogRepository;
    private readonly IBetaCodeRepository _betaCodeRepository;
    private readonly IStripeEventLogRepository _stripeEventLogRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IStripeSubscriptionService _stripeSubscriptionService;
    private readonly IAuditLogService _auditLogService;

    /// <summary>
    /// Initializes a new instance of the <see cref="TenantLifecycleService"/> class.
    /// </summary>
    public TenantLifecycleService(
        ILogger<TenantLifecycleService> logger,
        UserManager<ApplicationUser> userManager,
        ITenantRepository tenantRepository,
        IUserTenantMembershipRepository membershipRepository,
        IAppRepository appRepository,
        IDatabricksConnectionRepository connectionRepository,
        ISubscriptionSeatRepository seatRepository,
        ITenantInviteRepository inviteRepository,
        ITenantAiModelRepository tenantAiModelRepository,
        IUserTenantPreferenceRepository preferenceRepository,
        ISubscriptionHistoryRepository subscriptionHistoryRepository,
        IAuditLogRepository auditLogRepository,
        IBetaCodeRepository betaCodeRepository,
        IStripeEventLogRepository stripeEventLogRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IStripeSubscriptionService stripeSubscriptionService,
        IAuditLogService auditLogService)
    {
        _logger = logger;
        _userManager = userManager;
        _tenantRepository = tenantRepository;
        _membershipRepository = membershipRepository;
        _appRepository = appRepository;
        _connectionRepository = connectionRepository;
        _seatRepository = seatRepository;
        _inviteRepository = inviteRepository;
        _tenantAiModelRepository = tenantAiModelRepository;
        _preferenceRepository = preferenceRepository;
        _subscriptionHistoryRepository = subscriptionHistoryRepository;
        _auditLogRepository = auditLogRepository;
        _betaCodeRepository = betaCodeRepository;
        _stripeEventLogRepository = stripeEventLogRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _stripeSubscriptionService = stripeSubscriptionService;
        _auditLogService = auditLogService;
    }

    /// <inheritdoc/>
    public async Task<Result> DeactivateTenantAsync(Guid tenantId, Guid actingUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (tenant == null)
            {
                return Result.Fail(new NotFoundError($"Tenant {tenantId} not found"));
            }

            if (!tenant.IsActive)
            {
                return Result.Fail("Tenant is already inactive");
            }

            bool updated = await _tenantRepository.SetActiveAsync(tenantId, false, actingUserId, cancellationToken);
            if (!updated)
            {
                return Result.Fail("Failed to deactivate tenant");
            }

            await TryCancelStripeAsync(tenant, immediate: false, cancellationToken);
            await RevokeSoleTenantUserSessionsAsync(tenantId, cancellationToken);

            await WriteAuditAsync("TenantDeactivate", tenantId, actingUserId, new
            {
                tenantName = tenant.TenantName
            });

            _logger.LogInformation("Tenant {TenantId} deactivated by {ActingUserId}", tenantId, actingUserId);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deactivating tenant {TenantId}", tenantId);
            return Result.Fail($"Error deactivating tenant: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ReactivateTenantAsync(Guid tenantId, Guid actingUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (tenant == null)
            {
                return Result.Fail(new NotFoundError($"Tenant {tenantId} not found"));
            }

            if (tenant.IsActive)
            {
                return Result.Fail("Tenant is already active");
            }

            bool updated = await _tenantRepository.SetActiveAsync(tenantId, true, actingUserId, cancellationToken);
            if (!updated)
            {
                return Result.Fail("Failed to reactivate tenant");
            }

            await WriteAuditAsync("TenantReactivate", tenantId, actingUserId, new
            {
                tenantName = tenant.TenantName
            });

            _logger.LogInformation("Tenant {TenantId} reactivated by {ActingUserId}", tenantId, actingUserId);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reactivating tenant {TenantId}", tenantId);
            return Result.Fail($"Error reactivating tenant: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> CancelTenantSubscriptionAsync(Guid tenantId, bool immediate, Guid actingUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (tenant == null)
            {
                return Result.Fail(new NotFoundError($"Tenant {tenantId} not found"));
            }

            if (string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId))
            {
                return Result.Fail("Tenant has no active subscription to cancel");
            }

            Result<SubscriptionDto> stripeResult =
                await _stripeSubscriptionService.CancelSubscriptionAsync(tenantId, immediate, cancellationToken);

            if (stripeResult.IsFailed)
            {
                return stripeResult.ToResult();
            }

            await WriteAuditAsync("TenantCancelSubscription", tenantId, actingUserId, new
            {
                immediate
            });

            _logger.LogInformation(
                "Tenant {TenantId} subscription canceled (immediate={Immediate}) by {ActingUserId}",
                tenantId, immediate, actingUserId);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error canceling subscription for tenant {TenantId}", tenantId);
            return Result.Fail($"Error canceling subscription: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> SoftDeleteTenantAsync(Guid tenantId, Guid actingUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (tenant == null)
            {
                return Result.Fail(new NotFoundError($"Tenant {tenantId} not found"));
            }

            List<Guid> soleTenantUserIds = await _membershipRepository.GetSoleTenantUserIdsAsync(tenantId, cancellationToken);

            await TryCancelStripeAsync(tenant, immediate: true, cancellationToken);

            int apps = await _appRepository.SoftDeleteByTenantAsync(tenantId, actingUserId, cancellationToken);
            int connections = await _connectionRepository.SoftDeleteByTenantAsync(tenantId, actingUserId, cancellationToken);
            int seats = await _seatRepository.CancelAndSoftDeleteByTenantAsync(tenantId, actingUserId, cancellationToken);
            int invites = await _inviteRepository.CancelPendingByTenantAsync(tenantId, actingUserId, cancellationToken);
            int memberships = await _membershipRepository.SoftDeleteAllForTenantAsync(tenantId, actingUserId, cancellationToken);

            await DisableUsersAndRevokeSessionsAsync(soleTenantUserIds, actingUserId, cancellationToken);

            bool tenantDeleted = await _tenantRepository.SoftDeleteAsync(tenantId, actingUserId, cancellationToken);
            if (!tenantDeleted)
            {
                _logger.LogWarning("Tenant {TenantId} soft-delete reported no rows affected", tenantId);
            }

            await WriteAuditAsync("TenantSoftDelete", tenantId, actingUserId, new
            {
                tenantName = tenant.TenantName,
                cascade = new { memberships, apps, connections, seats, invites },
                disabledUserIds = soleTenantUserIds
            });

            _logger.LogInformation(
                "Tenant {TenantId} soft-deleted by {ActingUserId}. Cascade: {Memberships} memberships, {Apps} apps, {Connections} connections, {Seats} seats, {Invites} invites. {DisabledUsers} sole-tenant users disabled.",
                tenantId, actingUserId, memberships, apps, connections, seats, invites, soleTenantUserIds.Count);

            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error soft-deleting tenant {TenantId}", tenantId);
            return Result.Fail($"Error deleting tenant: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> PurgeTenantDataAsync(Guid tenantId, Guid actingUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (tenant == null)
            {
                return Result.Fail(new NotFoundError($"Tenant {tenantId} not found"));
            }

            string? billingCustomerId = tenant.BillingCustomerId;
            List<Guid> soleTenantUserIds = await _membershipRepository.GetSoleTenantUserIdsAsync(tenantId, cancellationToken);
            IReadOnlyList<int> connectionIds = await _connectionRepository.GetIdsByTenantAsync(tenantId, cancellationToken);

            // Best-effort Stripe work must stay outside the ambient DB transaction.
            // Catching DB failures inside TransactionScope leaves Postgres aborted (25P02).
            await TryCancelStripeAsync(tenant, immediate: true, cancellationToken);

            TenantPurgeCascadeCounts cascade;
            using (TransactionScope transaction = new(
                TransactionScopeOption.Required,
                TransactionScopeAsyncFlowOption.Enabled))
            {
                cascade = await HardDeleteTenantCascadeAsync(tenantId, connectionIds, cancellationToken);

                if (!string.IsNullOrWhiteSpace(billingCustomerId))
                {
                    int stripeEventLogs = await _stripeEventLogRepository.HardDeleteByCustomerIdAsync(
                        billingCustomerId,
                        cancellationToken);
                    cascade = cascade with { StripeEventLogs = stripeEventLogs };
                }

                bool tenantDeleted = await _tenantRepository.HardDeleteAsync(tenantId, cancellationToken);
                if (!tenantDeleted)
                {
                    _logger.LogWarning("Tenant {TenantId} hard-delete reported no rows affected", tenantId);
                }

                transaction.Complete();
            }

            // Post-commit: tombstone must not use a live Tenant FK (cascade would wipe it).
            await WriteAuditAsync(
                "TenantPurge",
                tenantId: null,
                actingUserId,
                new
                {
                    purgedTenantId = tenantId,
                    tenantName = tenant.TenantName,
                    cascade,
                    disabledUserIds = soleTenantUserIds
                },
                entityId: tenantId.ToString());

            // Best-effort identity disable must not fault the committed purge.
            try
            {
                await DisableUsersAndRevokeSessionsAsync(soleTenantUserIds, actingUserId, CancellationToken.None);
            }
            catch (Exception disableEx)
            {
                _logger.LogWarning(
                    disableEx,
                    "Post-purge user disable failed for tenant {TenantId}; purge already committed",
                    tenantId);
            }

            _logger.LogWarning(
                "Tenant {TenantId} purged by {ActingUserId}. Cascade: {Memberships} memberships, {Apps} apps, {AiModels} AI models, {Connections} connections, {Seats} seats, {Invites} invites, {Preferences} preferences, {History} history, {BetaRedemptions} beta redemptions, {AuditLogs} audit logs, {StripeEventLogs} Stripe event logs. {DisabledUsers} sole-tenant users disabled.",
                tenantId,
                actingUserId,
                cascade.Memberships,
                cascade.Apps,
                cascade.AiModels,
                cascade.Connections,
                cascade.Seats,
                cascade.Invites,
                cascade.Preferences,
                cascade.History,
                cascade.BetaRedemptions,
                cascade.AuditLogs,
                cascade.StripeEventLogs,
                soleTenantUserIds.Count);

            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error purging tenant {TenantId}", tenantId);
            string detail = ex.InnerException?.Message ?? ex.Message;
            return Result.Fail($"Error purging tenant: {detail}");
        }
    }

    private async Task<TenantPurgeCascadeCounts> HardDeleteTenantCascadeAsync(
        Guid tenantId,
        IReadOnlyCollection<int> connectionIds,
        CancellationToken cancellationToken)
    {
        // FK-safe order: Apps / TenantAiModels (Restrict→Connection) → Connections → remaining children.
        int apps = await _appRepository.HardDeleteForTenantPurgeAsync(tenantId, connectionIds, cancellationToken);
        int aiModels = await _tenantAiModelRepository.HardDeleteForTenantPurgeAsync(tenantId, connectionIds, cancellationToken);
        int connections = await _connectionRepository.HardDeleteByTenantAsync(tenantId, cancellationToken);
        int seats = await _seatRepository.HardDeleteByTenantAsync(tenantId, cancellationToken);
        int invites = await _inviteRepository.HardDeleteByTenantAsync(tenantId, cancellationToken);
        int memberships = await _membershipRepository.HardDeleteAllForTenantAsync(tenantId, cancellationToken);
        int preferences = await _preferenceRepository.HardDeleteByTenantAsync(tenantId, cancellationToken);
        int history = await _subscriptionHistoryRepository.HardDeleteByTenantAsync(tenantId, cancellationToken);
        int betaRedemptions = await _betaCodeRepository.HardDeleteRedemptionsByTenantAsync(tenantId, cancellationToken);
        int auditLogs = await _auditLogRepository.HardDeleteByTenantAsync(tenantId, cancellationToken);

        return new TenantPurgeCascadeCounts(
            Apps: apps,
            AiModels: aiModels,
            Connections: connections,
            Seats: seats,
            Invites: invites,
            Memberships: memberships,
            Preferences: preferences,
            History: history,
            BetaRedemptions: betaRedemptions,
            AuditLogs: auditLogs,
            StripeEventLogs: 0);
    }

    private sealed record TenantPurgeCascadeCounts(
        int Apps,
        int AiModels,
        int Connections,
        int Seats,
        int Invites,
        int Memberships,
        int Preferences,
        int History,
        int BetaRedemptions,
        int AuditLogs,
        int StripeEventLogs);

    private async Task TryCancelStripeAsync(Tenant tenant, bool immediate, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId))
        {
            _logger.LogInformation(
                "Skipping Stripe cancellation for tenant {TenantId}: no subscription on record",
                tenant.TenantId);
            return;
        }

        try
        {
            Result<SubscriptionDto> result =
                await _stripeSubscriptionService.CancelSubscriptionAsync(tenant.TenantId, immediate, cancellationToken);

            if (result.IsFailed)
            {
                _logger.LogWarning(
                    "Stripe cancellation for tenant {TenantId} returned failure: {Errors}",
                    tenant.TenantId,
                    string.Join("; ", result.Errors.Select(e => e.Message)));
            }
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stripe cancellation threw for tenant {TenantId}", tenant.TenantId);
        }
    }

    private async Task RevokeSoleTenantUserSessionsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        List<Guid> userIds = await _membershipRepository.GetSoleTenantUserIdsAsync(tenantId, cancellationToken);
        foreach (Guid userId in userIds)
        {
            try
            {
                await _refreshTokenRepository.RevokeAllForUserAsync(userId, cancellationToken);
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to revoke sessions for user {UserId}", userId);
            }
        }
    }

    private async Task DisableUsersAndRevokeSessionsAsync(IReadOnlyCollection<Guid> userIds, Guid actingUserId, CancellationToken cancellationToken)
    {
        foreach (Guid userId in userIds)
        {
            try
            {
                ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
                if (user != null && user.IsActive)
                {
                    user.IsActive = false;
                    user.ModifiedOn = DateTime.UtcNow;
                    user.ModifiedBy = actingUserId;
                    IdentityResult identityResult = await _userManager.UpdateAsync(user);
                    if (!identityResult.Succeeded)
                    {
                        _logger.LogWarning(
                            "Failed to disable user {UserId}: {Errors}",
                            userId,
                            string.Join(", ", identityResult.Errors.Select(e => e.Description)));
                    }
                }

                await _refreshTokenRepository.RevokeAllForUserAsync(userId, cancellationToken);
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to disable / revoke sessions for user {UserId}", userId);
            }
        }
    }

    private async Task WriteAuditAsync(
        string actionType,
        Guid? tenantId,
        Guid actingUserId,
        object metadata,
        string? entityId = null)
    {
        Result result = await TryWriteAuditAsync(actionType, tenantId, actingUserId, metadata, entityId);
        if (result.IsFailed)
        {
            _logger.LogWarning(
                "Failed to write audit log {ActionType} for tenant {TenantId}: {Errors}",
                actionType,
                tenantId,
                string.Join("; ", result.Errors.Select(e => e.Message)));
        }
    }

    private async Task<Result> TryWriteAuditAsync(
        string actionType,
        Guid? tenantId,
        Guid actingUserId,
        object metadata,
        string? entityId = null)
    {
        try
        {
            // EntityId/HistoricalEntityId are varchar(100). Put the short id there and the payload in Metadata (text).
            string? resolvedEntityId = entityId ?? tenantId?.ToString();
            string metadataJson = JsonSerializer.Serialize(metadata);
            Result result = await _auditLogService.LogActionAsync(
                ipAddress: AuditIp,
                userAgent: AuditUserAgent,
                actionType: actionType,
                tenantId: tenantId,
                userId: actingUserId,
                entityType: EntityTypeTenant,
                entityId: resolvedEntityId,
                severity: AuditSeverities.Warning,
                metadata: metadataJson);

            if (result.IsFailed)
            {
                return Result.Fail(new BadRequestError(
                    $"Failed to write audit log {actionType}: {string.Join("; ", result.Errors.Select(e => e.Message))}"));
            }

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Audit log write threw for {ActionType} tenant {TenantId}", actionType, tenantId);
            return Result.Fail(new BadRequestError($"Failed to write audit log {actionType}: {ex.Message}"));
        }
    }
}
