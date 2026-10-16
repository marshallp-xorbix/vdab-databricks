using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Tests for membership restore and removed-member listing.
/// </summary>
public class UserTenantMembershipRestoreTests
{
    [Fact]
    public async Task RestoreMembershipAsync_WhenSoftDeleted_PreservesRole()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid restoredBy = Guid.NewGuid();
        UserTenantMembership membership = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.TenantAdmin,
            DeletedOn = DateTime.UtcNow.AddDays(-3),
            DeletedBy = Guid.NewGuid(),
        };

        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(membership);

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = userId, DeletedOn = null });

        UserTenantMembershipService sut = CreateSut(repository, userManager);

        Result<UserTenantMembership> result =
            await sut.RestoreMembershipAsync(userId, tenantId, restoredBy);

        Assert.True(result.IsSuccess);
        Assert.Equal(AuthRoles.TenantAdmin, result.Value.Role);
        Assert.Equal(MembershipStatus.Active, membership.Status);
        Assert.Null(membership.DeletedOn);
        Assert.Null(membership.DeletedBy);
        repository.Verify(r => r.UpdateAsync(membership, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RestoreMembershipAsync_WhenUserRetired_ReturnsConflict()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        UserTenantMembership membership = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            DeletedOn = DateTime.UtcNow,
        };

        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(membership);

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(new ApplicationUser
            {
                Id = userId,
                DeletedOn = DateTime.UtcNow,
            });

        UserTenantMembershipService sut = CreateSut(repository, userManager);

        Result<UserTenantMembership> result =
            await sut.RestoreMembershipAsync(userId, tenantId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
        repository.Verify(r => r.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RestoreMembershipAsync_WhenNotFound_ReturnsNotFound()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserTenantMembership?)null);

        UserTenantMembershipService sut = CreateSut(repository, CreateUserManager());

        Result<UserTenantMembership> result =
            await sut.RestoreMembershipAsync(userId, tenantId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
    }

    [Fact]
    public async Task GetRemovedMembersAsync_ExcludesRetiredAccounts()
    {
        Guid tenantId = Guid.NewGuid();
        Guid liveUserId = Guid.NewGuid();
        Guid retiredUserId = Guid.NewGuid();
        DateTime removedOn = DateTime.UtcNow.AddDays(-2);
        Guid removedBy = Guid.NewGuid();

        List<UserTenantMembership> memberships =
        [
            new()
            {
                UserId = liveUserId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                DeletedOn = removedOn,
                DeletedBy = removedBy,
                User = new ApplicationUser
                {
                    Id = liveUserId,
                    Email = "live@example.com",
                    FirstName = "Live",
                    LastName = "User",
                    DeletedOn = null,
                },
            },
            new()
            {
                UserId = retiredUserId,
                TenantId = tenantId,
                Role = AuthRoles.TenantAdmin,
                DeletedOn = removedOn,
                DeletedBy = removedBy,
                User = new ApplicationUser
                {
                    Id = retiredUserId,
                    Email = "retired@example.com",
                    FirstName = "Retired",
                    LastName = "User",
                    DeletedOn = DateTime.UtcNow.AddDays(-1),
                },
            },
        ];

        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.GetSoftDeletedByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(memberships);

        UserTenantMembershipService sut = CreateSut(repository, CreateUserManager());

        Result<IReadOnlyList<RemovedTenantMemberDto>> result =
            await sut.GetRemovedMembersAsync(tenantId);

        Assert.True(result.IsSuccess);
        RemovedTenantMemberDto live = Assert.Single(result.Value);
        Assert.Equal(liveUserId, live.UserId);
        Assert.Equal("live@example.com", live.Email);
        Assert.Equal(AuthRoles.Developer, live.Role);
        Assert.Equal(removedOn, live.RemovedOn);
        Assert.Equal(removedBy, live.RemovedBy);
        Assert.DoesNotContain(result.Value, m => m.UserId == retiredUserId);
    }

    [Fact]
    public async Task GetRemovedMembersAsync_ExcludesEmailsWithPendingInvite()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        const string email = "pending@example.com";
        DateTime removedOn = DateTime.UtcNow.AddDays(-2);

        List<UserTenantMembership> memberships =
        [
            new()
            {
                UserId = userId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                DeletedOn = removedOn,
                User = new ApplicationUser
                {
                    Id = userId,
                    Email = email,
                    NormalizedEmail = email.ToUpperInvariant(),
                    FirstName = "Pending",
                    LastName = "Invite",
                    DeletedOn = null,
                },
            },
        ];

        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.GetSoftDeletedByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(memberships);

        Mock<ITenantInviteRepository> inviteRepository = new();
        inviteRepository
            .Setup(r => r.GetPendingByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new TenantInvite
                {
                    TenantId = tenantId,
                    Email = email,
                    NormalizedEmail = email.ToUpperInvariant(),
                    TokenHash = "hash",
                    Status = TenantInviteStatuses.Pending,
                },
            ]);

        Mock<IAuditLogService> auditLogService = new();
        UserTenantMembershipService sut = new(
            NullLogger<UserTenantMembershipService>.Instance,
            repository.Object,
            Mock.Of<ISubscriptionSeatRepository>(),
            inviteRepository.Object,
            CreateUserManager().Object,
            auditLogService.Object,
            Mock.Of<ITenantAccessRevocationService>(),
            Options.Create(new AccountLifecycleConfiguration()));

        Result<IReadOnlyList<RemovedTenantMemberDto>> result =
            await sut.GetRemovedMembersAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task GetRemovedMembersAsync_WhenRepositoryReturnsLatestEndedOnly_MapsSingleRowPerUser()
    {
        // GetSoftDeletedByTenantIdAsync collapses multiple Ended rows per user to the latest
        // DeletedOn; the service must surface that single row for the recovery UI.
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        DateTime latestRemoval = DateTime.UtcNow.AddDays(-1);

        List<UserTenantMembership> memberships =
        [
            new()
            {
                UserId = userId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                DeletedOn = latestRemoval,
                DeletedBy = Guid.NewGuid(),
                User = new ApplicationUser
                {
                    Id = userId,
                    Email = "repeat@example.com",
                    FirstName = "Repeat",
                    LastName = "Member",
                },
            },
        ];

        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.GetSoftDeletedByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(memberships);

        UserTenantMembershipService sut = CreateSut(repository, CreateUserManager());

        Result<IReadOnlyList<RemovedTenantMemberDto>> result =
            await sut.GetRemovedMembersAsync(tenantId);

        Assert.True(result.IsSuccess);
        RemovedTenantMemberDto row = Assert.Single(result.Value);
        Assert.Equal(userId, row.UserId);
        Assert.Equal(latestRemoval, row.RemovedOn);
    }

    [Fact]
    public async Task RestoreMembershipAsync_WhenOutsideReinstatementWindow_ReturnsGone()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        UserTenantMembership membership = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            Status = MembershipStatus.Ended,
            DeletedOn = DateTime.UtcNow.AddDays(-120),
        };

        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(membership);

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = userId, DeletedOn = null });

        UserTenantMembershipService sut = CreateSut(
            repository,
            userManager,
            Options.Create(new AccountLifecycleConfiguration { MembershipReinstatementDays = 90 }));

        Result<UserTenantMembership> result =
            await sut.RestoreMembershipAsync(userId, tenantId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<GoneError>());
        repository.Verify(r => r.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task EndAllLiveMembershipsForPlatformRetirementAsync_WritesMembershipEndAuditPerTenant()
    {
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();
        Guid tenantA = Guid.NewGuid();
        Guid tenantB = Guid.NewGuid();

        List<UserTenantMembership> live =
        [
            new()
            {
                UserId = userId,
                TenantId = tenantA,
                Role = AuthRoles.Developer,
                Status = MembershipStatus.Active,
            },
            new()
            {
                UserId = userId,
                TenantId = tenantB,
                Role = AuthRoles.TenantAdmin,
                Status = MembershipStatus.Active,
            },
        ];

        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.GetLiveByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(live);
        repository
            .Setup(r => r.GetByUserAndTenantAsync(userId, tenantA, It.IsAny<CancellationToken>()))
            .ReturnsAsync(live[0]);
        repository
            .Setup(r => r.GetByUserAndTenantAsync(userId, tenantB, It.IsAny<CancellationToken>()))
            .ReturnsAsync(live[1]);
        repository
            .Setup(r => r.RemoveAsync(userId, It.IsAny<Guid>(), performedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        repository
            .Setup(r => r.GetUserDefaultTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserTenantMembership?)null);
        repository
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());

        Mock<ISubscriptionSeatRepository> seatRepository = new();
        seatRepository
            .Setup(r => r.GetByUserAsync(It.IsAny<Guid>(), userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubscriptionSeat?)null);

        Mock<IAuditLogService> auditLogService = new();
        auditLogService
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "MembershipEnd",
                It.IsAny<Guid?>(),
                performedBy,
                "tenant-membership",
                userId.ToString(),
                AuditSeverities.Info,
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());

        UserTenantMembershipService sut = new(
            NullLogger<UserTenantMembershipService>.Instance,
            repository.Object,
            seatRepository.Object,
            Mock.Of<ITenantInviteRepository>(),
            CreateUserManager().Object,
            auditLogService.Object,
            Mock.Of<ITenantAccessRevocationService>(),
            Options.Create(new AccountLifecycleConfiguration()));

        Result<IReadOnlyList<Guid>> result =
            await sut.EndAllLiveMembershipsForPlatformRetirementAsync(userId, performedBy);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.Equal(2, result.Value.Count);
        auditLogService.Verify(
            s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "MembershipEnd",
                tenantA,
                performedBy,
                "tenant-membership",
                userId.ToString(),
                AuditSeverities.Info,
                It.IsAny<string?>()),
            Times.Once);
        auditLogService.Verify(
            s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "MembershipEnd",
                tenantB,
                performedBy,
                "tenant-membership",
                userId.ToString(),
                AuditSeverities.Info,
                It.IsAny<string?>()),
            Times.Once);
    }

    private static Mock<UserManager<ApplicationUser>> CreateUserManager() =>
        new(Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    private static UserTenantMembershipService CreateSut(
        Mock<IUserTenantMembershipRepository> repository,
        Mock<UserManager<ApplicationUser>> userManager,
        Microsoft.Extensions.Options.IOptions<AccountLifecycleConfiguration>? lifecycleOptions = null)
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

        Mock<ITenantInviteRepository> inviteRepository = new();
        inviteRepository
            .Setup(r => r.GetPendingByTenantAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<TenantInvite>());

        return new UserTenantMembershipService(
            NullLogger<UserTenantMembershipService>.Instance,
            repository.Object,
            Mock.Of<ISubscriptionSeatRepository>(),
            inviteRepository.Object,
            userManager.Object,
            auditLogService.Object,
            Mock.Of<ITenantAccessRevocationService>(),
            lifecycleOptions ?? Options.Create(new AccountLifecycleConfiguration()));
    }
}
