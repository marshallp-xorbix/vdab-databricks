using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Soft-delete retires the account without mangling email/username (Phase 2).
/// </summary>
public class UserServiceSoftDeleteTests
{
    private readonly Mock<UserManager<ApplicationUser>> _userManager = new(
        Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepository = new();
    private readonly Mock<IAuditLogService> _auditLogService = new();
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();
    private readonly Mock<ITenantRepository> _tenantRepository = new();
    private readonly Mock<ITenantAccessRevocationService> _tenantAccessRevocation = new();

    [Fact]
    public async Task SoftDeleteUserAsync_LeavesEmailAndUserNameIntact_SetsPlatformRetirement()
    {
        Guid userId = Guid.NewGuid();
        Guid deletedByUserId = Guid.NewGuid();
        const string email = "alice@acme.com";
        const string userName = "alice@acme.com";
        ApplicationUser user = new()
        {
            Id = userId,
            Email = email,
            UserName = userName,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = userName.ToUpperInvariant(),
            IsActive = true,
            DeletedOn = null,
        };

        _userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(manager => manager.UpdateSecurityStampAsync(user)).ReturnsAsync(IdentityResult.Success);
        _refreshTokenRepository
            .Setup(repository => repository.RevokeAllForUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _tenantRepository
            .Setup(repository => repository.IsOwnerOfAnyTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _membershipService
            .Setup(service => service.EndAllLiveMembershipsForPlatformRetirementAsync(
                userId, deletedByUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<IReadOnlyList<Guid>>([]));
        _auditLogService
            .Setup(service => service.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserSoftDelete",
                It.IsAny<Guid?>(),
                deletedByUserId,
                "User",
                userId.ToString(),
                AuditSeverities.Info,
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());

        UserService service = CreateService();

        Result result = await service.SoftDeleteUserAsync(userId, deletedByUserId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.Equal(email, user.Email);
        Assert.Equal(userName, user.UserName);
        Assert.False(user.IsActive);
        Assert.NotNull(user.DeletedOn);
        Assert.Equal(deletedByUserId, user.DeletedBy);
        Assert.Equal(AccountRetirementReason.Platform, user.RetirementReason);
        _userManager.Verify(manager => manager.UpdateNormalizedEmailAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _userManager.Verify(manager => manager.UpdateNormalizedUserNameAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _membershipService.Verify(
            service => service.EndAllLiveMembershipsForPlatformRetirementAsync(
                userId, deletedByUserId, It.IsAny<CancellationToken>()),
            Times.Once);
        _refreshTokenRepository.Verify(
            repository => repository.RevokeAllForUserAsync(userId, It.IsAny<CancellationToken>()),
            Times.Once);
        _auditLogService.Verify(
            service => service.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserSoftDelete",
                It.IsAny<Guid?>(),
                deletedByUserId,
                "User",
                userId.ToString(),
                AuditSeverities.Info,
                It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task SoftDeleteUserAsync_WhenUserOwnsTenant_ReturnsConflict()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            Email = "owner@acme.com",
            UserName = "owner@acme.com",
            IsActive = true,
            DeletedOn = null,
        };

        _userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _tenantRepository
            .Setup(repository => repository.IsOwnerOfAnyTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        UserService service = CreateService();

        Result result = await service.SoftDeleteUserAsync(userId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
        _membershipService.Verify(
            service => service.EndAllLiveMembershipsForPlatformRetirementAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SoftDeleteUserAsync_RevokesTenantAccessAfterTransactionCompletes()
    {
        Guid userId = Guid.NewGuid();
        Guid deletedByUserId = Guid.NewGuid();
        Guid tenantA = Guid.NewGuid();
        Guid tenantB = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            Email = "multi@acme.com",
            UserName = "multi@acme.com",
            IsActive = true,
            DeletedOn = null,
        };

        bool endMembershipsCompleted = false;
        _userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(manager => manager.UpdateSecurityStampAsync(user)).ReturnsAsync(IdentityResult.Success);
        _refreshTokenRepository
            .Setup(repository => repository.RevokeAllForUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _tenantRepository
            .Setup(repository => repository.IsOwnerOfAnyTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _membershipService
            .Setup(service => service.EndAllLiveMembershipsForPlatformRetirementAsync(
                userId, deletedByUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<IReadOnlyList<Guid>>([tenantA, tenantB]))
            .Callback(() => endMembershipsCompleted = true);
        _auditLogService
            .Setup(service => service.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserSoftDelete",
                It.IsAny<Guid?>(),
                deletedByUserId,
                "User",
                userId.ToString(),
                AuditSeverities.Info,
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());
        _tenantAccessRevocation
            .Setup(service => service.RevokeAsync(userId, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask)
            .Callback(() => Assert.True(endMembershipsCompleted));

        UserService service = CreateService();

        Result result = await service.SoftDeleteUserAsync(userId, deletedByUserId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantA, It.IsAny<CancellationToken>()),
            Times.Once);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantB, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private UserService CreateService() =>
        new(
            NullLogger<UserService>.Instance,
            _userManager.Object,
            Mock.Of<IUserRepository>(),
            _refreshTokenRepository.Object,
            Mock.Of<IEmailSenderService>(),
            _membershipService.Object,
            _tenantRepository.Object,
            _tenantAccessRevocation.Object,
            Mock.Of<IBillingService>(),
            Mock.Of<IBetaCodeRepository>(),
            Mock.Of<IInternalDevTenantService>(),
            Options.Create(new PolicyConsentConfiguration()),
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = true }),
            _auditLogService.Object);
}
