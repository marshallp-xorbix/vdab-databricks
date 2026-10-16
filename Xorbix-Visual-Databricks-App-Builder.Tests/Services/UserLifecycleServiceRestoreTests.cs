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
/// Tests for <see cref="UserLifecycleService.ReactivateUserAsync"/> restore semantics.
/// </summary>
public class UserLifecycleServiceRestoreTests
{
    [Fact]
    public async Task ReactivateUserAsync_WhenUserNotFound_ReturnsNotFound()
    {
        Guid userId = Guid.NewGuid();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync((ApplicationUser?)null);

        UserLifecycleService sut = CreateSut(userManager: userManager);

        Result result = await sut.ReactivateUserAsync(userId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
    }

    [Fact]
    public async Task ReactivateUserAsync_WhenAlreadyActiveAndNotTombstoned_ReturnsBadRequest()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = true,
            DeletedOn = null,
        };
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        UserLifecycleService sut = CreateSut(userManager: userManager);

        Result result = await sut.ReactivateUserAsync(userId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
        userManager.Verify(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task ReactivateUserAsync_WhenRetired_ClearsTombstoneFields()
    {
        Guid userId = Guid.NewGuid();
        Guid restoredBy = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = false,
            DeletedOn = DateTime.UtcNow.AddDays(-1),
            DeletedBy = Guid.NewGuid(),
            RetirementReason = AccountRetirementReason.Platform,
        };
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        Mock<IAuditLogService> auditLogService = CreateSuccessfulAuditService();
        UserLifecycleService sut = CreateSut(userManager: userManager, auditLogService: auditLogService);

        Result result = await sut.ReactivateUserAsync(userId, restoredBy);

        Assert.True(result.IsSuccess);
        Assert.True(user.IsActive);
        Assert.Null(user.DeletedOn);
        Assert.Null(user.DeletedBy);
        Assert.Null(user.RetirementReason);
        Assert.Equal(restoredBy, user.ModifiedBy);
        auditLogService.Verify(
            service => service.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserRestore",
                It.IsAny<Guid?>(),
                restoredBy,
                "User",
                userId.ToString(),
                AuditSeverities.Info,
                It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task ReactivateUserAsync_WhenFailedRescueEncoding_ClearsTombstone()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = true,
            DeletedOn = DateTime.UtcNow.AddDays(-2),
            DeletedBy = Guid.NewGuid(),
            RetirementReason = AccountRetirementReason.Platform,
        };
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        UserLifecycleService sut = CreateSut(userManager: userManager);

        Result result = await sut.ReactivateUserAsync(userId, Guid.NewGuid());

        Assert.True(result.IsSuccess);
        Assert.Null(user.DeletedOn);
        Assert.Null(user.DeletedBy);
        Assert.Null(user.RetirementReason);
    }

    [Fact]
    public async Task ReactivateUserAsync_WhenDuplicateIdentityError_ReturnsConflict()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = false,
            DeletedOn = DateTime.UtcNow,
        };
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager
            .Setup(manager => manager.UpdateAsync(user))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError
            {
                Code = "DuplicateUserName",
                Description = "Username 'alice@acme.com' is already taken.",
            }));

        UserLifecycleService sut = CreateSut(userManager: userManager);

        Result result = await sut.ReactivateUserAsync(userId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
    }

    private static Mock<UserManager<ApplicationUser>> CreateUserManager() =>
        new(Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

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

    private static UserLifecycleService CreateSut(
        Mock<UserManager<ApplicationUser>>? userManager = null,
        Mock<IAuditLogService>? auditLogService = null) =>
        new(
            NullLogger<UserLifecycleService>.Instance,
            (userManager ?? CreateUserManager()).Object,
            Mock.Of<IUserRepository>(),
            Mock.Of<IAppRepository>(),
            Mock.Of<IDatabricksConnectionRepository>(),
            Mock.Of<ITenantAiModelRepository>(),
            Mock.Of<IUserTenantMembershipRepository>(),
            Mock.Of<IUserTenantPreferenceRepository>(),
            Mock.Of<ISubscriptionSeatRepository>(),
            Mock.Of<IRefreshTokenRepository>(),
            Mock.Of<IUserPlatformAiUsageRepository>(),
            Mock.Of<IDatabricksUserTokenRepository>(),
            Mock.Of<IAuditLogRepository>(),
            Mock.Of<ITenantRepository>(),
            (auditLogService ?? CreateSuccessfulAuditService()).Object,
            Options.Create(new AccountLifecycleConfiguration()));
}
