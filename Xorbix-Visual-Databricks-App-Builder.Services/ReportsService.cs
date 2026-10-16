using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Reports;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Aggregates platform-wide statistics for administrator reports.
/// </summary>
public class ReportsService : IReportsService
{
    private const int NewUsersWindowDays = 30;

    // TODO: Replace with real health probe aggregation once a health service exists.
    private const string DefaultSystemHealthStatus = "Operational";

    private readonly IUserRepository _userRepository;
    private readonly IAppRepository _appRepository;
    private readonly ITenantInviteRepository _tenantInviteRepository;
    private readonly IDatabricksConnectionRepository _databricksConnectionRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly ILogger<ReportsService> _logger;

    public ReportsService(
        IUserRepository userRepository,
        IAppRepository appRepository,
        ITenantInviteRepository tenantInviteRepository,
        IDatabricksConnectionRepository databricksConnectionRepository,
        ITenantRepository tenantRepository,
        ILogger<ReportsService> logger)
    {
        _userRepository = userRepository;
        _appRepository = appRepository;
        _tenantInviteRepository = tenantInviteRepository;
        _databricksConnectionRepository = databricksConnectionRepository;
        _tenantRepository = tenantRepository;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<ReportsStatsResponse>> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            DateTime now = DateTime.UtcNow;
            DateTime newUsersSince = now.AddDays(-NewUsersWindowDays);

            // Sequential awaits: the repositories share a single scoped DbContext,
            // which is not safe for concurrent operations.
            int activeUsers = await _userRepository.CountActiveUsersAsync(cancellationToken);
            int newUsers = await _userRepository.CountUsersCreatedSinceAsync(newUsersSince, cancellationToken);
            int pendingInvites = await _tenantInviteRepository.CountPendingInvitesAsync(cancellationToken);
            int activeApps = await _appRepository.CountActiveAppsAsync(cancellationToken);
            int activeWorkspaces = await _databricksConnectionRepository.CountActiveWorkspacesAsync(cancellationToken);
            int activeTenants = await _tenantRepository.CountActiveTenantsAsync(cancellationToken);
            int newTenants = await _tenantRepository.CountTenantsCreatedSinceAsync(newUsersSince, cancellationToken);

            ReportsStatsResponse response = new()
            {
                ActiveUsersCount = activeUsers,
                NewUsersLast30DaysCount = newUsers,
                PendingInvitesCount = pendingInvites,
                ActiveAppsCount = activeApps,
                ActiveWorkspacesCount = activeWorkspaces,
                ActiveTenantsCount = activeTenants,
                NewTenantsLast30DaysCount = newTenants,
                SystemHealthStatus = DefaultSystemHealthStatus,
                GeneratedAt = now,
            };

            return Result.Ok(response);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to compute reports stats snapshot.");
            return Result.Fail<ReportsStatsResponse>(
                new ExceptionalError("Failed to compute reports stats snapshot.", ex));
        }
    }
}
