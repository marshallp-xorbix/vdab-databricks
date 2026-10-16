using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class TenantServiceSubscriptionLimitTests
{
    [Fact]
    public async Task GetUsageDashboardAsync_ReturnsTierConfiguredAppAndConnectionLimits()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);
        TenantUsageStatsDto stats = CreateStats(tenantId, subscriptionTier: SubscriptionTierNames.Team, userCount: 4, appCount: 7, connectionCount: 3, maxUsers: 50, maxPublishedApps: 10, maxWorkspaceConnections: 5);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, stats);
        Mock<IUserTenantMembershipService> userTenantMembershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        tierService.Setup(service => service.GetTierLimits(SubscriptionTierNames.Team))
            .Returns(FluentResults.Result.Ok(new SubscriptionTierLimits
            {
                MinimumSeats = 5,
                MaxPublishedApps = 10,
                MaxWorkspaceConnections = 5
            }));

        TenantService service = new TenantService(
            NullLogger<TenantService>.Instance,
            tenantRepository.Object,
            userTenantMembershipService.Object,
            tierService.Object,
            new Mock<IStripeCustomerService>().Object,
            new Mock<IAuditLogService>().Object);

        FluentResults.Result<TenantUsageStatsDto> result = await service.GetUsageDashboardAsync(tenantId);

        Assert.True(result.IsSuccess);
        tenantRepository.Verify(repository => repository.GetByIdAsync(It.IsAny<Guid>()), Times.Never);
        Assert.Equal(50, result.Value.MaxUsers);
        Assert.Equal(10, result.Value.MaxPublishedApps);
        Assert.Equal(5, result.Value.MaxWorkspaceConnections);
    }

    [Fact]
    public async Task GetUsageDashboardAsync_FailsWhenTierLimitsCannotBeResolved()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, "UnknownTier");
        TenantUsageStatsDto stats = CreateStats(tenantId, subscriptionTier: "UnknownTier", userCount: 1, appCount: 1, connectionCount: 1, maxUsers: 5);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, stats);
        Mock<IUserTenantMembershipService> userTenantMembershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        tierService.Setup(service => service.GetTierLimits("UnknownTier"))
            .Returns(FluentResults.Result.Fail<SubscriptionTierLimits>("Tier limits missing"));

        TenantService service = new TenantService(
            NullLogger<TenantService>.Instance,
            tenantRepository.Object,
            userTenantMembershipService.Object,
            tierService.Object,
            new Mock<IStripeCustomerService>().Object,
            new Mock<IAuditLogService>().Object);

        FluentResults.Result<TenantUsageStatsDto> result = await service.GetUsageDashboardAsync(tenantId);

        Assert.True(result.IsFailed);
        tenantRepository.Verify(repository => repository.GetByIdAsync(It.IsAny<Guid>()), Times.Never);
        Assert.Contains("Tier limits missing", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateSubscriptionLimitsAsync_App_UsesTierConfigLimit()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);
        TenantUsageStatsDto stats = CreateStats(tenantId, subscriptionTier: SubscriptionTierNames.Team, userCount: 1, appCount: 2, connectionCount: 1, maxUsers: 50);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, stats);
        Mock<IUserTenantMembershipService> userTenantMembershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        tierService.Setup(service => service.GetTierLimits(SubscriptionTierNames.Team))
            .Returns(FluentResults.Result.Ok(new SubscriptionTierLimits
            {
                MinimumSeats = 5,
                MaxPublishedApps = 2,
                MaxWorkspaceConnections = 5
            }));

        TenantService service = new TenantService(
            NullLogger<TenantService>.Instance,
            tenantRepository.Object,
            userTenantMembershipService.Object,
            tierService.Object,
            new Mock<IStripeCustomerService>().Object,
            new Mock<IAuditLogService>().Object);

        FluentResults.Result result = await service.ValidateSubscriptionLimitsAsync(tenantId, "App");

        Assert.True(result.IsFailed);
        Assert.Contains("Subscription limit reached", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateSubscriptionLimitsAsync_Connection_AllowsUnlimitedTierLimit()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Enterprise);
        TenantUsageStatsDto stats = CreateStats(tenantId, subscriptionTier: SubscriptionTierNames.Enterprise, userCount: 1, appCount: 200, connectionCount: 500, maxUsers: 50);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, stats);
        Mock<IUserTenantMembershipService> userTenantMembershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        tierService.Setup(service => service.GetTierLimits(SubscriptionTierNames.Enterprise))
            .Returns(FluentResults.Result.Ok(new SubscriptionTierLimits
            {
                MinimumSeats = 0,
                MaxPublishedApps = 0,
                MaxWorkspaceConnections = 0
            }));

        TenantService service = new TenantService(
            NullLogger<TenantService>.Instance,
            tenantRepository.Object,
            userTenantMembershipService.Object,
            tierService.Object,
            new Mock<IStripeCustomerService>().Object,
            new Mock<IAuditLogService>().Object);

        FluentResults.Result result = await service.ValidateSubscriptionLimitsAsync(tenantId, "Connection");

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task ValidateSubscriptionLimitsAsync_User_StillUsesTenantMaxUsers()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);
        TenantUsageStatsDto stats = CreateStats(tenantId, subscriptionTier: SubscriptionTierNames.Team, userCount: 3, appCount: 1, connectionCount: 1, maxUsers: 3);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, stats);
        Mock<IUserTenantMembershipService> userTenantMembershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        tierService.Setup(service => service.GetTierLimits(SubscriptionTierNames.Team))
            .Returns(FluentResults.Result.Ok(new SubscriptionTierLimits
            {
                MinimumSeats = 5,
                MaxPublishedApps = 10,
                MaxWorkspaceConnections = 5
            }));

        TenantService service = new TenantService(
            NullLogger<TenantService>.Instance,
            tenantRepository.Object,
            userTenantMembershipService.Object,
            tierService.Object,
            new Mock<IStripeCustomerService>().Object,
            new Mock<IAuditLogService>().Object);

        FluentResults.Result result = await service.ValidateSubscriptionLimitsAsync(tenantId, "User");

        Assert.True(result.IsFailed);
        Assert.Contains("Subscription limit reached", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    private static Tenant CreateTenant(Guid tenantId, string subscriptionTier)
    {
        return new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = subscriptionTier
        };
    }

    private static TenantUsageStatsDto CreateStats(
        Guid tenantId,
        string subscriptionTier,
        int userCount,
        int appCount,
        int connectionCount,
        int maxUsers,
        int maxPublishedApps = 999,
        int maxWorkspaceConnections = 999)
    {
        return new TenantUsageStatsDto
        {
            TenantId = tenantId,
            DisplayName = "Tenant",
            SubscriptionTier = subscriptionTier,
            UserCount = userCount,
            AppCount = appCount,
            ConnectionCount = connectionCount,
            MaxUsers = maxUsers,
            MaxPublishedApps = maxPublishedApps,
            MaxWorkspaceConnections = maxWorkspaceConnections
        };
    }

    private static Mock<ITenantRepository> CreateTenantRepository(Tenant tenant, TenantUsageStatsDto stats)
    {
        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenant.TenantId)).ReturnsAsync(tenant);
        tenantRepository.Setup(repository => repository.GetUsageStatsAsync(tenant.TenantId)).ReturnsAsync(stats);
        return tenantRepository;
    }
}