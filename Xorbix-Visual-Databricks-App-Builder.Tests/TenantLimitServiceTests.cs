using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class TenantLimitServiceTests
{
    [Fact]
    public async Task EnsureCanCreateAppAsync_SucceedsWhenUnderLimit()
    {
        Guid tenantId = Guid.NewGuid();
        TenantLimitService service = CreateService(tenantId, appCount: 5, maxPublishedApps: 10, connectionCount: 0, maxWorkspaceConnections: 10);

        Result result = await service.EnsureCanCreateAppAsync(tenantId);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task EnsureCanCreateAppAsync_FailsWhenAtLimit()
    {
        Guid tenantId = Guid.NewGuid();
        TenantLimitService service = CreateService(tenantId, appCount: 10, maxPublishedApps: 10, connectionCount: 0, maxWorkspaceConnections: 10);

        Result result = await service.EnsureCanCreateAppAsync(tenantId);

        Assert.True(result.IsFailed);
        Assert.IsType<ForbiddenError>(result.Errors[0]);
    }

    [Fact]
    public async Task EnsureCanCreateAppAsync_SucceedsWhenLimitIsUnlimited()
    {
        Guid tenantId = Guid.NewGuid();
        TenantLimitService service = CreateService(tenantId, appCount: 500, maxPublishedApps: 0, connectionCount: 0, maxWorkspaceConnections: 0);

        Result result = await service.EnsureCanCreateAppAsync(tenantId);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task EnsureCanAddWorkspaceConnectionAsync_FailsWhenAtLimit()
    {
        Guid tenantId = Guid.NewGuid();
        TenantLimitService service = CreateService(tenantId, appCount: 0, maxPublishedApps: 10, connectionCount: 3, maxWorkspaceConnections: 3);

        Result result = await service.EnsureCanAddWorkspaceConnectionAsync(tenantId);

        Assert.True(result.IsFailed);
        Assert.IsType<ForbiddenError>(result.Errors[0]);
    }

    [Fact]
    public async Task EnsureCanAddWorkspaceConnectionAsync_SucceedsWhenUnderLimit()
    {
        Guid tenantId = Guid.NewGuid();
        TenantLimitService service = CreateService(tenantId, appCount: 0, maxPublishedApps: 10, connectionCount: 2, maxWorkspaceConnections: 3);

        Result result = await service.EnsureCanAddWorkspaceConnectionAsync(tenantId);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task EnsureCanCreateAppAsync_FailsWhenSubscriptionPaused()
    {
        Guid tenantId = Guid.NewGuid();
        // Even with unlimited limits, a paused subscription blocks resource creation.
        TenantLimitService service = CreateService(tenantId, appCount: 0, maxPublishedApps: 0, connectionCount: 0, maxWorkspaceConnections: 0, subscriptionStatus: SubscriptionStatusNames.Paused);

        Result result = await service.EnsureCanCreateAppAsync(tenantId);

        Assert.True(result.IsFailed);
        Assert.IsType<ForbiddenError>(result.Errors[0]);
    }

    [Fact]
    public async Task EnsureCanAddWorkspaceConnectionAsync_FailsWhenSubscriptionPaused()
    {
        Guid tenantId = Guid.NewGuid();
        TenantLimitService service = CreateService(tenantId, appCount: 0, maxPublishedApps: 10, connectionCount: 0, maxWorkspaceConnections: 10, subscriptionStatus: SubscriptionStatusNames.Paused);

        Result result = await service.EnsureCanAddWorkspaceConnectionAsync(tenantId);

        Assert.True(result.IsFailed);
        Assert.IsType<ForbiddenError>(result.Errors[0]);
    }

    [Fact]
    public async Task EnsureCanCreateAppAsync_SucceedsWhenTrialingUnderLimit()
    {
        Guid tenantId = Guid.NewGuid();
        TenantLimitService service = CreateService(tenantId, appCount: 1, maxPublishedApps: 3, connectionCount: 0, maxWorkspaceConnections: 3, subscriptionStatus: SubscriptionStatusNames.Trialing);

        Result result = await service.EnsureCanCreateAppAsync(tenantId);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task EnsureCanCreateAppAsync_FailsWithNotFoundWhenTenantMissing()
    {
        Guid tenantId = Guid.NewGuid();
        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository
            .Setup(repository => repository.GetUsageStatsAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((TenantUsageStatsDto?)null);

        TenantLimitService service = new TenantLimitService(
            NullLogger<TenantLimitService>.Instance,
            tenantRepository.Object);

        Result result = await service.EnsureCanCreateAppAsync(tenantId);

        Assert.True(result.IsFailed);
        Assert.IsType<NotFoundError>(result.Errors[0]);
    }

    private static TenantLimitService CreateService(
        Guid tenantId,
        int appCount,
        int maxPublishedApps,
        int connectionCount,
        int maxWorkspaceConnections,
        string subscriptionStatus = SubscriptionStatusNames.Active)
    {
        TenantUsageStatsDto stats = new TenantUsageStatsDto
        {
            TenantId = tenantId,
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Team,
            SubscriptionStatus = subscriptionStatus,
            UserCount = 0,
            AppCount = appCount,
            ConnectionCount = connectionCount,
            MaxUsers = 0,
            MaxPublishedApps = maxPublishedApps,
            MaxWorkspaceConnections = maxWorkspaceConnections
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository
            .Setup(repository => repository.GetUsageStatsAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stats);

        return new TenantLimitService(
            NullLogger<TenantLimitService>.Instance,
            tenantRepository.Object);
    }
}
