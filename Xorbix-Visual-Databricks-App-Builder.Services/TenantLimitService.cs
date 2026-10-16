using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Enforces tenant subscription feature limits using the tenant's persisted effective limits
/// and current usage counts. A limit of <c>0</c> indicates unlimited.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="TenantLimitService"/> class.
/// </remarks>
public class TenantLimitService(
    ILogger<TenantLimitService> _logger,
    ITenantRepository _tenantRepository) : ITenantLimitService
{
    /// <inheritdoc/>
    public async Task<Result> EnsureCanCreateAppAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Result<TenantUsageStatsDto> statsResult = await GetUsageStatsAsync(tenantId, cancellationToken);
        if (statsResult.IsFailed)
        {
            return Result.Fail(statsResult.Errors);
        }

        TenantUsageStatsDto stats = statsResult.Value;
        Result lockResult = EnsureSubscriptionNotLocked(tenantId, stats.SubscriptionStatus);
        if (lockResult.IsFailed)
        {
            return lockResult;
        }

        if (IsWithinLimit(stats.AppCount, stats.MaxPublishedApps))
        {
            return Result.Ok();
        }

        _logger.LogInformation(
            "App creation blocked for tenant {TenantId}: at limit ({AppCount}/{MaxPublishedApps}).",
            tenantId, stats.AppCount, stats.MaxPublishedApps);

        return Result.Fail(new ForbiddenError(
            $"Your plan allows up to {stats.MaxPublishedApps} app(s). Upgrade your plan or add seats to create more."));
    }

    /// <inheritdoc/>
    public async Task<Result> EnsureCanAddWorkspaceConnectionAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Result<TenantUsageStatsDto> statsResult = await GetUsageStatsAsync(tenantId, cancellationToken);
        if (statsResult.IsFailed)
        {
            return Result.Fail(statsResult.Errors);
        }

        TenantUsageStatsDto stats = statsResult.Value;
        Result lockResult = EnsureSubscriptionNotLocked(tenantId, stats.SubscriptionStatus);
        if (lockResult.IsFailed)
        {
            return lockResult;
        }

        if (IsWithinLimit(stats.ConnectionCount, stats.MaxWorkspaceConnections))
        {
            return Result.Ok();
        }

        _logger.LogInformation(
            "Workspace connection creation blocked for tenant {TenantId}: at limit ({ConnectionCount}/{MaxWorkspaceConnections}).",
            tenantId, stats.ConnectionCount, stats.MaxWorkspaceConnections);

        return Result.Fail(new ForbiddenError(
            $"Your plan allows up to {stats.MaxWorkspaceConnections} workspace connection(s). Upgrade your plan or add seats to add more."));
    }

    private async Task<Result<TenantUsageStatsDto>> GetUsageStatsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        TenantUsageStatsDto? stats = await _tenantRepository.GetUsageStatsAsync(tenantId, cancellationToken);
        if (stats == null)
        {
            return Result.Fail<TenantUsageStatsDto>(new NotFoundError($"Tenant '{tenantId}' not found."));
        }

        return Result.Ok(stats);
    }

    /// <inheritdoc/>
    public async Task<Result> EnsureSubscriptionActiveAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Result<TenantUsageStatsDto> statsResult = await GetUsageStatsAsync(tenantId, cancellationToken);
        if (statsResult.IsFailed)
        {
            return Result.Fail(statsResult.Errors);
        }

        return EnsureSubscriptionNotLocked(tenantId, statsResult.Value.SubscriptionStatus);
    }

    /// <summary>
    /// Blocks resource creation while the subscription is in a locked status (for example,
    /// a paused no-card trial). Because a persisted limit of <c>0</c> means unlimited,
    /// locked accounts are gated on status rather than zeroed limits.
    /// </summary>
    private Result EnsureSubscriptionNotLocked(Guid tenantId, string subscriptionStatus)
    {
        if (string.IsNullOrEmpty(subscriptionStatus) || !SubscriptionStatusNames.LockedStatuses.Contains(subscriptionStatus))
        {
            return Result.Ok();
        }

        _logger.LogInformation(
            "Resource creation blocked for tenant {TenantId}: subscription status {SubscriptionStatus} is locked.",
            tenantId, subscriptionStatus);

        return Result.Fail(new ForbiddenError(
            "Your trial has ended and your account is paused. Add a payment method to reactivate your account."));
    }

    /// <summary>
    /// Determines whether a new item may be created given the current count and the limit.
    /// A limit of <c>0</c> means unlimited.
    /// </summary>
    private static bool IsWithinLimit(int currentCount, int limit)
    {
        return limit <= 0 || currentCount < limit;
    }
}
