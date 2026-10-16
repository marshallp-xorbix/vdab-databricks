using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies tenant hard-purge deletes children in FK-safe order and retains sole-tenant users.
/// </summary>
public class TenantLifecycleServicePurgeTests
{
    [Fact]
    public async Task PurgeTenantDataAsync_WhenTenantMissing_ReturnsNotFound()
    {
        Mock<ITenantRepository> tenantRepository = new();
        tenantRepository
            .Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);

        TenantLifecycleService sut = CreateSut(new PurgeTestDeps { TenantRepository = tenantRepository });

        Result result = await sut.PurgeTenantDataAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
    }

    [Fact]
    public async Task PurgeTenantDataAsync_DeletesRestrictChildrenBeforeConnections()
    {
        Guid tenantId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        List<int> connectionIds = [42];
        List<string> callOrder = [];

        Tenant tenant = CreateTenant(tenantId, billingCustomerId: null);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, callOrder);
        Mock<IDatabricksConnectionRepository> connectionRepository =
            CreateConnectionRepository(tenantId, connectionIds, callOrder);
        Mock<IAppRepository> appRepository = CreateAppRepository(tenantId, callOrder);
        Mock<ITenantAiModelRepository> aiModelRepository = CreateAiModelRepository(tenantId, callOrder);

        Mock<IUserTenantMembershipRepository> membershipRepository = new();
        membershipRepository
            .Setup(r => r.GetSoleTenantUserIdsAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        membershipRepository
            .Setup(r => r.HardDeleteAllForTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        Mock<IAuditLogService> auditLogService = CreateSuccessfulAuditService(callOrder);

        TenantLifecycleService sut = CreateSut(new PurgeTestDeps
        {
            TenantRepository = tenantRepository,
            MembershipRepository = membershipRepository,
            AppRepository = appRepository,
            ConnectionRepository = connectionRepository,
            TenantAiModelRepository = aiModelRepository,
            AuditLogService = auditLogService,
        });

        Result result = await sut.PurgeTenantDataAsync(tenantId, actingUserId);

        Assert.True(result.IsSuccess);
        Assert.True(callOrder.IndexOf("apps") < callOrder.IndexOf("connections"));
        Assert.True(callOrder.IndexOf("aiModels") < callOrder.IndexOf("connections"));
        Assert.True(callOrder.IndexOf("tenant") < callOrder.IndexOf("audit"));

        appRepository.Verify(
            r => r.HardDeleteForTenantPurgeAsync(
                tenantId,
                It.Is<IReadOnlyCollection<int>>(ids => ids.SequenceEqual(connectionIds)),
                It.IsAny<CancellationToken>()),
            Times.Once);
        aiModelRepository.Verify(
            r => r.HardDeleteForTenantPurgeAsync(
                tenantId,
                It.Is<IReadOnlyCollection<int>>(ids => ids.SequenceEqual(connectionIds)),
                It.IsAny<CancellationToken>()),
            Times.Once);
        auditLogService.Verify(
            s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "TenantPurge",
                null,
                actingUserId,
                It.IsAny<string?>(),
                tenantId.ToString(),
                AuditSeverities.Warning,
                It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task PurgeTenantDataAsync_WhenNoConnections_StillPurgesAndAudits()
    {
        Guid tenantId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        List<int> connectionIds = [];

        Tenant tenant = CreateTenant(tenantId, billingCustomerId: null);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, callOrder: null);
        Mock<IDatabricksConnectionRepository> connectionRepository =
            CreateConnectionRepository(tenantId, connectionIds, callOrder: null);

        Mock<IAppRepository> appRepository = new();
        appRepository
            .Setup(r => r.HardDeleteForTenantPurgeAsync(
                tenantId,
                It.Is<IReadOnlyCollection<int>>(ids => ids.Count == 0),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        Mock<ITenantAiModelRepository> aiModelRepository = new();
        aiModelRepository
            .Setup(r => r.HardDeleteForTenantPurgeAsync(
                tenantId,
                It.Is<IReadOnlyCollection<int>>(ids => ids.Count == 0),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        Mock<IUserTenantMembershipRepository> membershipRepository = new();
        membershipRepository
            .Setup(r => r.GetSoleTenantUserIdsAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        membershipRepository
            .Setup(r => r.HardDeleteAllForTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        Mock<IAuditLogService> auditLogService = CreateSuccessfulAuditService(callOrder: null);

        TenantLifecycleService sut = CreateSut(new PurgeTestDeps
        {
            TenantRepository = tenantRepository,
            MembershipRepository = membershipRepository,
            AppRepository = appRepository,
            ConnectionRepository = connectionRepository,
            TenantAiModelRepository = aiModelRepository,
            AuditLogService = auditLogService,
        });

        Result result = await sut.PurgeTenantDataAsync(tenantId, actingUserId);

        Assert.True(result.IsSuccess);
        appRepository.Verify(
            r => r.HardDeleteForTenantPurgeAsync(
                tenantId,
                It.Is<IReadOnlyCollection<int>>(ids => ids.Count == 0),
                It.IsAny<CancellationToken>()),
            Times.Once);
        auditLogService.Verify(
            s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "TenantPurge",
                null,
                actingUserId,
                It.IsAny<string?>(),
                tenantId.ToString(),
                AuditSeverities.Warning,
                It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task PurgeTenantDataAsync_DisablesSoleTenantUsers_DoesNotDeleteIdentity()
    {
        Guid tenantId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        Guid soleUserId = Guid.NewGuid();
        const string billingCustomerId = "cus_test_123";

        Tenant tenant = CreateTenant(tenantId, billingCustomerId);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, callOrder: null);
        Mock<IDatabricksConnectionRepository> connectionRepository =
            CreateConnectionRepository(tenantId, [42], callOrder: null);
        Mock<IAppRepository> appRepository = CreateAppRepository(tenantId, callOrder: null);
        Mock<ITenantAiModelRepository> aiModelRepository = CreateAiModelRepository(tenantId, callOrder: null);

        Mock<IUserTenantMembershipRepository> membershipRepository = new();
        membershipRepository
            .Setup(r => r.GetSoleTenantUserIdsAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([soleUserId]);
        membershipRepository
            .Setup(r => r.HardDeleteAllForTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        Mock<IStripeEventLogRepository> stripeEventLogRepository = new();
        stripeEventLogRepository
            .Setup(r => r.HardDeleteByCustomerIdAsync(billingCustomerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        ApplicationUser soleUser = new() { Id = soleUserId, IsActive = true };
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(soleUserId.ToString()))
            .ReturnsAsync(soleUser);
        userManager
            .Setup(m => m.UpdateAsync(soleUser))
            .ReturnsAsync(IdentityResult.Success);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(r => r.RevokeAllForUserAsync(soleUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        TenantLifecycleService sut = CreateSut(new PurgeTestDeps
        {
            TenantRepository = tenantRepository,
            MembershipRepository = membershipRepository,
            AppRepository = appRepository,
            ConnectionRepository = connectionRepository,
            TenantAiModelRepository = aiModelRepository,
            StripeEventLogRepository = stripeEventLogRepository,
            RefreshTokenRepository = refreshTokenRepository,
            AuditLogService = CreateSuccessfulAuditService(callOrder: null),
            UserManager = userManager,
        });

        Result result = await sut.PurgeTenantDataAsync(tenantId, actingUserId);

        Assert.True(result.IsSuccess);
        userManager.Verify(m => m.UpdateAsync(soleUser), Times.Once);
        userManager.Verify(m => m.DeleteAsync(It.IsAny<ApplicationUser>()), Times.Never);
        Assert.False(soleUser.IsActive);
        stripeEventLogRepository.Verify(
            r => r.HardDeleteByCustomerIdAsync(billingCustomerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task PurgeTenantDataAsync_WhenPostCommitDisableThrows_StillReturnsOk()
    {
        Guid tenantId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        Guid soleUserId = Guid.NewGuid();

        Tenant tenant = CreateTenant(tenantId, billingCustomerId: null);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant, callOrder: null);
        Mock<IDatabricksConnectionRepository> connectionRepository =
            CreateConnectionRepository(tenantId, [], callOrder: null);

        Mock<IUserTenantMembershipRepository> membershipRepository = new();
        membershipRepository
            .Setup(r => r.GetSoleTenantUserIdsAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([soleUserId]);
        membershipRepository
            .Setup(r => r.HardDeleteAllForTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(soleUserId.ToString()))
            .ThrowsAsync(new InvalidOperationException("identity store unavailable"));

        TenantLifecycleService sut = CreateSut(new PurgeTestDeps
        {
            TenantRepository = tenantRepository,
            MembershipRepository = membershipRepository,
            ConnectionRepository = connectionRepository,
            AuditLogService = CreateSuccessfulAuditService(callOrder: null),
            UserManager = userManager,
        });

        Result result = await sut.PurgeTenantDataAsync(tenantId, actingUserId);

        Assert.True(result.IsSuccess);
        tenantRepository.Verify(r => r.HardDeleteAsync(tenantId, It.IsAny<CancellationToken>()), Times.Once);
    }

    private sealed class PurgeTestDeps
    {
        public Mock<ITenantRepository>? TenantRepository { get; init; }
        public Mock<IUserTenantMembershipRepository>? MembershipRepository { get; init; }
        public Mock<IAppRepository>? AppRepository { get; init; }
        public Mock<IDatabricksConnectionRepository>? ConnectionRepository { get; init; }
        public Mock<ITenantAiModelRepository>? TenantAiModelRepository { get; init; }
        public Mock<IStripeEventLogRepository>? StripeEventLogRepository { get; init; }
        public Mock<IRefreshTokenRepository>? RefreshTokenRepository { get; init; }
        public Mock<IAuditLogService>? AuditLogService { get; init; }
        public Mock<UserManager<ApplicationUser>>? UserManager { get; init; }
    }

    private static Tenant CreateTenant(Guid tenantId, string? billingCustomerId) =>
        new()
        {
            TenantId = tenantId,
            TenantName = "acme",
            DisplayName = "Acme",
            BillingCustomerId = billingCustomerId,
            IsActive = true,
        };

    private static Mock<ITenantRepository> CreateTenantRepository(Tenant tenant, List<string>? callOrder)
    {
        Mock<ITenantRepository> tenantRepository = new();
        tenantRepository
            .Setup(r => r.GetByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        tenantRepository
            .Setup(r => r.HardDeleteAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .Callback(() => callOrder?.Add("tenant"))
            .ReturnsAsync(true);
        return tenantRepository;
    }

    private static Mock<IDatabricksConnectionRepository> CreateConnectionRepository(
        Guid tenantId,
        IReadOnlyList<int> connectionIds,
        List<string>? callOrder)
    {
        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        connectionRepository
            .Setup(r => r.GetIdsByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(connectionIds);
        connectionRepository
            .Setup(r => r.HardDeleteByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .Callback(() => callOrder?.Add("connections"))
            .ReturnsAsync(connectionIds.Count);
        return connectionRepository;
    }

    private static Mock<IAppRepository> CreateAppRepository(Guid tenantId, List<string>? callOrder)
    {
        Mock<IAppRepository> appRepository = new();
        appRepository
            .Setup(r => r.HardDeleteForTenantPurgeAsync(
                tenantId,
                It.IsAny<IReadOnlyCollection<int>>(),
                It.IsAny<CancellationToken>()))
            .Callback(() => callOrder?.Add("apps"))
            .ReturnsAsync(1);
        return appRepository;
    }

    private static Mock<ITenantAiModelRepository> CreateAiModelRepository(Guid tenantId, List<string>? callOrder)
    {
        Mock<ITenantAiModelRepository> aiModelRepository = new();
        aiModelRepository
            .Setup(r => r.HardDeleteForTenantPurgeAsync(
                tenantId,
                It.IsAny<IReadOnlyCollection<int>>(),
                It.IsAny<CancellationToken>()))
            .Callback(() => callOrder?.Add("aiModels"))
            .ReturnsAsync(1);
        return aiModelRepository;
    }

    private static Mock<IAuditLogService> CreateSuccessfulAuditService(List<string>? callOrder)
    {
        Mock<IAuditLogService> auditLogService = new();
        auditLogService
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .Callback(() => callOrder?.Add("audit"))
            .ReturnsAsync(Result.Ok());
        return auditLogService;
    }

    private static Mock<UserManager<ApplicationUser>> CreateUserManager()
    {
        return new Mock<UserManager<ApplicationUser>>(
            Mock.Of<IUserStore<ApplicationUser>>(),
            null!, null!, null!, null!, null!, null!, null!, null!);
    }

    private static TenantLifecycleService CreateSut(PurgeTestDeps deps)
    {
        return new TenantLifecycleService(
            NullLogger<TenantLifecycleService>.Instance,
            (deps.UserManager ?? CreateUserManager()).Object,
            (deps.TenantRepository ?? new Mock<ITenantRepository>()).Object,
            (deps.MembershipRepository ?? new Mock<IUserTenantMembershipRepository>()).Object,
            (deps.AppRepository ?? new Mock<IAppRepository>()).Object,
            (deps.ConnectionRepository ?? new Mock<IDatabricksConnectionRepository>()).Object,
            new Mock<ISubscriptionSeatRepository>().Object,
            new Mock<ITenantInviteRepository>().Object,
            (deps.TenantAiModelRepository ?? new Mock<ITenantAiModelRepository>()).Object,
            new Mock<IUserTenantPreferenceRepository>().Object,
            new Mock<ISubscriptionHistoryRepository>().Object,
            new Mock<IAuditLogRepository>().Object,
            new Mock<IBetaCodeRepository>().Object,
            (deps.StripeEventLogRepository ?? new Mock<IStripeEventLogRepository>()).Object,
            (deps.RefreshTokenRepository ?? new Mock<IRefreshTokenRepository>()).Object,
            new Mock<IStripeSubscriptionService>().Object,
            (deps.AuditLogService ?? new Mock<IAuditLogService>()).Object);
    }
}
