using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies GDPR user hard-purge guards and Restrict-FK cleanup before Identity delete.
/// </summary>
public class UserLifecycleServicePurgeTests
{
    [Fact]
    public async Task PurgeUserDataAsync_WhenSelfPurge_ReturnsBadRequest()
    {
        Guid userId = Guid.NewGuid();
        UserLifecycleService sut = CreateSut();

        Result result = await sut.PurgeUserDataAsync(userId, userId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
    }

    [Fact]
    public async Task PurgeUserDataAsync_WhenUserMissing_ReturnsNotFound()
    {
        Guid userId = Guid.NewGuid();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(userId.ToString()))
            .ReturnsAsync((ApplicationUser?)null);

        UserLifecycleService sut = CreateSut(userManager: userManager);

        Result result = await sut.PurgeUserDataAsync(userId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
    }

    [Fact]
    public async Task PurgeUserDataAsync_WhenSoleGlobalAdministrator_ReturnsConflict()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new() { Id = userId, Email = "admin@example.com" };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(user);
        userManager
            .Setup(m => m.IsInRoleAsync(user, AuthRoles.Administrator))
            .ReturnsAsync(true);
        userManager
            .Setup(m => m.GetUsersInRoleAsync(AuthRoles.Administrator))
            .ReturnsAsync(new List<ApplicationUser> { user });

        UserLifecycleService sut = CreateSut(userManager: userManager);

        Result result = await sut.PurgeUserDataAsync(userId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
        userManager.Verify(m => m.DeleteAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task PurgeUserDataAsync_WhenAdminHasPeers_Proceeds()
    {
        Guid userId = Guid.NewGuid();
        Guid peerAdminId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        ApplicationUser user = new() { Id = userId, Email = "admin@example.com" };
        ApplicationUser peer = new() { Id = peerAdminId, Email = "peer@example.com" };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(user);
        userManager
            .Setup(m => m.IsInRoleAsync(user, AuthRoles.Administrator))
            .ReturnsAsync(true);
        userManager
            .Setup(m => m.GetUsersInRoleAsync(AuthRoles.Administrator))
            .ReturnsAsync(new List<ApplicationUser> { user, peer });
        userManager
            .Setup(m => m.DeleteAsync(user))
            .ReturnsAsync(IdentityResult.Success);

        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        connectionRepository
            .Setup(r => r.GetIdsByOwnerAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<int>());
        connectionRepository
            .Setup(r => r.HardDeleteByOwnerAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        Mock<IAuditLogService> auditLogService = new();
        auditLogService
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserPurge",
                null,
                actingUserId,
                It.IsAny<string?>(),
                userId.ToString(),
                AuditSeverities.Warning,
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());

        UserLifecycleService sut = CreateSut(
            userManager: userManager,
            connectionRepository: connectionRepository,
            auditLogService: auditLogService);

        Result result = await sut.PurgeUserDataAsync(userId, actingUserId);

        Assert.True(result.IsSuccess);
        userManager.Verify(m => m.DeleteAsync(user), Times.Once);
    }

    [Fact]
    public async Task PurgeUserDataAsync_DeletesOwnedResourcesThenIdentityUser_UnassignsSeats_AndAudits()
    {
        Guid userId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        ApplicationUser user = new() { Id = userId, Email = "user@example.com" };
        List<string> callOrder = [];

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(user);
        userManager
            .Setup(m => m.IsInRoleAsync(user, AuthRoles.Administrator))
            .ReturnsAsync(false);
        userManager
            .Setup(m => m.DeleteAsync(user))
            .Callback(() => callOrder.Add("identity"))
            .ReturnsAsync(IdentityResult.Success);

        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        connectionRepository
            .Setup(r => r.GetIdsByOwnerAsync(userId, It.IsAny<CancellationToken>()))
            .Callback(() => callOrder.Add("connectionIds"))
            .ReturnsAsync(new List<int> { 10, 20 });
        connectionRepository
            .Setup(r => r.HardDeleteByOwnerAsync(userId, It.IsAny<CancellationToken>()))
            .Callback(() => callOrder.Add("connections"))
            .ReturnsAsync(2);

        Mock<IAppRepository> appRepository = new();
        appRepository
            .Setup(r => r.HardDeleteForUserPurgeAsync(
                userId,
                It.Is<IReadOnlyCollection<int>>(ids => ids.Contains(10) && ids.Contains(20)),
                It.IsAny<CancellationToken>()))
            .Callback(() => callOrder.Add("apps"))
            .ReturnsAsync(2);

        Mock<ITenantAiModelRepository> aiModelRepository = new();
        aiModelRepository
            .Setup(r => r.HardDeleteByConnectionIdsAsync(
                It.Is<IReadOnlyCollection<int>>(ids => ids.Contains(10) && ids.Contains(20)),
                It.IsAny<CancellationToken>()))
            .Callback(() => callOrder.Add("aiModels"))
            .ReturnsAsync(1);

        Mock<IUserTenantMembershipRepository> membershipRepository = new();
        membershipRepository
            .Setup(r => r.HardDeleteAllForUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        Mock<IUserTenantPreferenceRepository> preferenceRepository = new();
        preferenceRepository
            .Setup(r => r.HardDeleteByUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        Mock<ISubscriptionSeatRepository> seatRepository = new();
        seatRepository
            .Setup(r => r.UnassignByUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(r => r.HardDeleteByUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(3);

        Mock<IUserPlatformAiUsageRepository> platformAiUsageRepository = new();
        platformAiUsageRepository
            .Setup(r => r.HardDeleteByUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        Mock<IDatabricksUserTokenRepository> databricksUserTokenRepository = new();
        databricksUserTokenRepository
            .Setup(r => r.HardDeleteByUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        Mock<IAuditLogRepository> auditLogRepository = new();
        auditLogRepository
            .Setup(r => r.HardDeleteByUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(4);

        Mock<ITenantRepository> tenantRepository = new();
        tenantRepository
            .Setup(r => r.ClearOwnerIdForUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        Mock<IAuditLogService> auditLogService = new();
        auditLogService
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserPurge",
                null,
                actingUserId,
                It.IsAny<string?>(),
                userId.ToString(),
                AuditSeverities.Warning,
                It.IsAny<string?>()))
            .Callback(() => callOrder.Add("audit"))
            .ReturnsAsync(Result.Ok());

        UserLifecycleService sut = CreateSut(
            userManager: userManager,
            appRepository: appRepository,
            connectionRepository: connectionRepository,
            tenantAiModelRepository: aiModelRepository,
            membershipRepository: membershipRepository,
            preferenceRepository: preferenceRepository,
            seatRepository: seatRepository,
            refreshTokenRepository: refreshTokenRepository,
            platformAiUsageRepository: platformAiUsageRepository,
            databricksUserTokenRepository: databricksUserTokenRepository,
            auditLogRepository: auditLogRepository,
            tenantRepository: tenantRepository,
            auditLogService: auditLogService);

        Result result = await sut.PurgeUserDataAsync(userId, actingUserId);

        Assert.True(result.IsSuccess);
        Assert.True(callOrder.IndexOf("connectionIds") < callOrder.IndexOf("apps"));
        Assert.True(callOrder.IndexOf("apps") < callOrder.IndexOf("connections"));
        Assert.True(callOrder.IndexOf("aiModels") < callOrder.IndexOf("connections"));
        Assert.True(callOrder.IndexOf("connections") < callOrder.IndexOf("identity"));
        Assert.True(callOrder.IndexOf("identity") < callOrder.IndexOf("audit"));
        userManager.Verify(m => m.DeleteAsync(user), Times.Once);
        seatRepository.Verify(r => r.UnassignByUserAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
        seatRepository.Verify(r => r.HardDeleteByTenantAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        auditLogRepository.Verify(r => r.HardDeleteByUserAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
        tenantRepository.Verify(r => r.ClearOwnerIdForUserAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
        auditLogService.Verify(
            s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserPurge",
                null,
                actingUserId,
                It.IsAny<string?>(),
                userId.ToString(),
                AuditSeverities.Warning,
                It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task PurgeUserDataAsync_WhenNoOwnedConnections_StillDeletesIdentity()
    {
        Guid userId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        ApplicationUser user = new() { Id = userId, Email = "user@example.com" };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(user);
        userManager
            .Setup(m => m.IsInRoleAsync(user, AuthRoles.Administrator))
            .ReturnsAsync(false);
        userManager
            .Setup(m => m.DeleteAsync(user))
            .ReturnsAsync(IdentityResult.Success);

        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        connectionRepository
            .Setup(r => r.GetIdsByOwnerAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<int>());
        connectionRepository
            .Setup(r => r.HardDeleteByOwnerAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        Mock<IAppRepository> appRepository = new();
        appRepository
            .Setup(r => r.HardDeleteForUserPurgeAsync(
                userId,
                It.Is<IReadOnlyCollection<int>>(ids => ids.Count == 0),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        Mock<ITenantAiModelRepository> aiModelRepository = new();
        aiModelRepository
            .Setup(r => r.HardDeleteByConnectionIdsAsync(
                It.Is<IReadOnlyCollection<int>>(ids => ids.Count == 0),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        UserLifecycleService sut = CreateSut(
            userManager: userManager,
            appRepository: appRepository,
            connectionRepository: connectionRepository,
            tenantAiModelRepository: aiModelRepository,
            auditLogService: CreateSuccessfulAuditService());

        Result result = await sut.PurgeUserDataAsync(userId, actingUserId);

        Assert.True(result.IsSuccess);
        userManager.Verify(m => m.DeleteAsync(user), Times.Once);
        appRepository.Verify(
            r => r.HardDeleteForUserPurgeAsync(
                userId,
                It.Is<IReadOnlyCollection<int>>(ids => ids.Count == 0),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static Mock<IAuditLogService> CreateSuccessfulAuditService()
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
            .ReturnsAsync(Result.Ok());
        return auditLogService;
    }

    private static Mock<UserManager<ApplicationUser>> CreateUserManager()
    {
        return new Mock<UserManager<ApplicationUser>>(
            Mock.Of<IUserStore<ApplicationUser>>(),
            null!, null!, null!, null!, null!, null!, null!, null!);
    }

    private static UserLifecycleService CreateSut(
        Mock<UserManager<ApplicationUser>>? userManager = null,
        Mock<IAppRepository>? appRepository = null,
        Mock<IDatabricksConnectionRepository>? connectionRepository = null,
        Mock<ITenantAiModelRepository>? tenantAiModelRepository = null,
        Mock<IUserTenantMembershipRepository>? membershipRepository = null,
        Mock<IUserTenantPreferenceRepository>? preferenceRepository = null,
        Mock<ISubscriptionSeatRepository>? seatRepository = null,
        Mock<IRefreshTokenRepository>? refreshTokenRepository = null,
        Mock<IUserPlatformAiUsageRepository>? platformAiUsageRepository = null,
        Mock<IDatabricksUserTokenRepository>? databricksUserTokenRepository = null,
        Mock<IAuditLogRepository>? auditLogRepository = null,
        Mock<ITenantRepository>? tenantRepository = null,
        Mock<IAuditLogService>? auditLogService = null,
        Mock<IUserRepository>? userRepository = null,
        IOptions<AccountLifecycleConfiguration>? accountLifecycleOptions = null)
    {
        return new UserLifecycleService(
            NullLogger<UserLifecycleService>.Instance,
            (userManager ?? CreateUserManager()).Object,
            (userRepository ?? new Mock<IUserRepository>()).Object,
            (appRepository ?? new Mock<IAppRepository>()).Object,
            (connectionRepository ?? new Mock<IDatabricksConnectionRepository>()).Object,
            (tenantAiModelRepository ?? new Mock<ITenantAiModelRepository>()).Object,
            (membershipRepository ?? new Mock<IUserTenantMembershipRepository>()).Object,
            (preferenceRepository ?? new Mock<IUserTenantPreferenceRepository>()).Object,
            (seatRepository ?? new Mock<ISubscriptionSeatRepository>()).Object,
            (refreshTokenRepository ?? new Mock<IRefreshTokenRepository>()).Object,
            (platformAiUsageRepository ?? new Mock<IUserPlatformAiUsageRepository>()).Object,
            (databricksUserTokenRepository ?? new Mock<IDatabricksUserTokenRepository>()).Object,
            (auditLogRepository ?? new Mock<IAuditLogRepository>()).Object,
            (tenantRepository ?? new Mock<ITenantRepository>()).Object,
            (auditLogService ?? CreateSuccessfulAuditService()).Object,
            accountLifecycleOptions ?? Options.Create(new AccountLifecycleConfiguration()));
    }
}
