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
/// Lazy anonymization of stale Retired rows (Phase 5).
/// </summary>
public class UserLifecycleServiceAnonymizeTests
{
    [Fact]
    public async Task TryAnonymizeStaleRetiredByEmailAsync_WhenClockNull_DoesNotQueryOrUpdate()
    {
        Mock<IUserRepository> userRepository = new();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();

        UserLifecycleService sut = CreateSut(
            userManager: userManager,
            userRepository: userRepository,
            accountLifecycleOptions: Options.Create(new AccountLifecycleConfiguration
            {
                RetiredAnonymizationDays = null
            }));

        Result result = await sut.TryAnonymizeStaleRetiredByEmailAsync("alice@example.com");

        Assert.True(result.IsSuccess);
        userRepository.Verify(
            r => r.GetRetiredByNormalizedEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        userManager.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task TryAnonymizeStaleRetiredByEmailAsync_WhenWithinWindow_SkipsAnonymize()
    {
        Guid retiredId = Guid.NewGuid();
        ApplicationUser retired = new()
        {
            Id = retiredId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            DeletedOn = DateTime.UtcNow.AddDays(-10),
            AnonymizedOn = null,
            FirstName = "Alice",
            LastName = "Smith"
        };

        Mock<IUserRepository> userRepository = new();
        userRepository
            .Setup(r => r.GetRetiredByNormalizedEmailAsync("ALICE@EXAMPLE.COM", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ApplicationUser> { retired });

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.NormalizeEmail("alice@example.com")).Returns("ALICE@EXAMPLE.COM");

        UserLifecycleService sut = CreateSut(
            userManager: userManager,
            userRepository: userRepository,
            accountLifecycleOptions: Options.Create(new AccountLifecycleConfiguration
            {
                RetiredAnonymizationDays = 90
            }));

        Result result = await sut.TryAnonymizeStaleRetiredByEmailAsync("alice@example.com");

        Assert.True(result.IsSuccess);
        userManager.Verify(m => m.FindByIdAsync(It.IsAny<string>()), Times.Never);
        userManager.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task TryAnonymizeStaleRetiredByEmailAsync_WhenStale_AnonymizesAndAudits()
    {
        Guid retiredId = Guid.NewGuid();
        ApplicationUser retiredLookup = new()
        {
            Id = retiredId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            DeletedOn = DateTime.UtcNow.AddDays(-120),
            AnonymizedOn = null
        };
        ApplicationUser retiredTracked = new()
        {
            Id = retiredId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            UserName = "alice@example.com",
            NormalizedUserName = "ALICE@EXAMPLE.COM",
            DeletedOn = DateTime.UtcNow.AddDays(-120),
            AnonymizedOn = null,
            FirstName = "Alice",
            LastName = "Smith",
            PhoneNumber = "555-0100"
        };

        Mock<IUserRepository> userRepository = new();
        userRepository
            .Setup(r => r.GetRetiredByNormalizedEmailAsync("ALICE@EXAMPLE.COM", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ApplicationUser> { retiredLookup });

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.NormalizeEmail("alice@example.com")).Returns("ALICE@EXAMPLE.COM");
        userManager
            .Setup(m => m.NormalizeEmail(It.Is<string>(e => e.StartsWith(RetiredUserAnonymization.EmailPrefix, StringComparison.Ordinal))))
            .Returns<string>(e => e.ToUpperInvariant());
        userManager.Setup(m => m.FindByIdAsync(retiredId.ToString())).ReturnsAsync(retiredTracked);
        userManager
            .Setup(m => m.UpdateAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync(IdentityResult.Success);

        Mock<IAuditLogService> auditLogService = new();
        auditLogService
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserAnonymize",
                null,
                null,
                "User",
                retiredId.ToString(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());

        UserLifecycleService sut = CreateSut(
            userManager: userManager,
            userRepository: userRepository,
            auditLogService: auditLogService,
            accountLifecycleOptions: Options.Create(new AccountLifecycleConfiguration
            {
                RetiredAnonymizationDays = 90
            }));

        Result result = await sut.TryAnonymizeStaleRetiredByEmailAsync("alice@example.com");

        Assert.True(result.IsSuccess);
        Assert.NotNull(retiredTracked.AnonymizedOn);
        Assert.Equal(RetiredUserAnonymization.FormatEmail(retiredId), retiredTracked.Email);
        Assert.Equal(RetiredUserAnonymization.FirstName, retiredTracked.FirstName);
        Assert.Null(retiredTracked.PhoneNumber);
        auditLogService.Verify(
            s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserAnonymize",
                null,
                null,
                "User",
                retiredId.ToString(),
                It.IsAny<string>(),
                It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task TryAnonymizeStaleRetiredByEmailAsync_WhenAuditFails_ContinuesScanAndReturnsOk()
    {
        Guid retiredId = Guid.NewGuid();
        ApplicationUser retiredLookup = new()
        {
            Id = retiredId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            DeletedOn = DateTime.UtcNow.AddDays(-120),
            AnonymizedOn = null
        };
        ApplicationUser retiredTracked = new()
        {
            Id = retiredId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            UserName = "alice@example.com",
            NormalizedUserName = "ALICE@EXAMPLE.COM",
            DeletedOn = DateTime.UtcNow.AddDays(-120),
            AnonymizedOn = null,
            FirstName = "Alice",
            LastName = "Smith"
        };

        Mock<IUserRepository> userRepository = new();
        userRepository
            .Setup(r => r.GetRetiredByNormalizedEmailAsync("ALICE@EXAMPLE.COM", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ApplicationUser> { retiredLookup });

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.NormalizeEmail("alice@example.com")).Returns("ALICE@EXAMPLE.COM");
        userManager
            .Setup(m => m.NormalizeEmail(It.Is<string>(e => e.StartsWith(RetiredUserAnonymization.EmailPrefix, StringComparison.Ordinal))))
            .Returns<string>(e => e.ToUpperInvariant());
        userManager.Setup(m => m.FindByIdAsync(retiredId.ToString())).ReturnsAsync(retiredTracked);
        userManager
            .Setup(m => m.UpdateAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync(IdentityResult.Success);

        Mock<IAuditLogService> auditLogService = new();
        auditLogService
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<Guid?>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Fail(new BadRequestError("audit write failed")));

        UserLifecycleService sut = CreateSut(
            userManager: userManager,
            userRepository: userRepository,
            auditLogService: auditLogService,
            accountLifecycleOptions: Options.Create(new AccountLifecycleConfiguration
            {
                RetiredAnonymizationDays = 90
            }));

        Result result = await sut.TryAnonymizeStaleRetiredByEmailAsync("alice@example.com");

        // Best-effort: per-row failure is logged; sweep still returns Ok.
        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task TryAnonymizeStaleRetiredByEmailAsync_WhenFirstCandidateFails_ContinuesToSecond()
    {
        Guid failingId = Guid.NewGuid();
        Guid succeedingId = Guid.NewGuid();
        DateTime staleDeletedOn = DateTime.UtcNow.AddDays(-120);

        ApplicationUser failingLookup = new()
        {
            Id = failingId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            DeletedOn = staleDeletedOn,
            AnonymizedOn = null
        };
        ApplicationUser succeedingLookup = new()
        {
            Id = succeedingId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            DeletedOn = staleDeletedOn,
            AnonymizedOn = null
        };
        ApplicationUser failingTracked = new()
        {
            Id = failingId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            UserName = "alice@example.com",
            NormalizedUserName = "ALICE@EXAMPLE.COM",
            DeletedOn = staleDeletedOn,
            AnonymizedOn = null,
            FirstName = "Alice",
            LastName = "One"
        };
        ApplicationUser succeedingTracked = new()
        {
            Id = succeedingId,
            Email = "alice@example.com",
            NormalizedEmail = "ALICE@EXAMPLE.COM",
            UserName = "alice@example.com",
            NormalizedUserName = "ALICE@EXAMPLE.COM",
            DeletedOn = staleDeletedOn,
            AnonymizedOn = null,
            FirstName = "Alice",
            LastName = "Two"
        };

        Mock<IUserRepository> userRepository = new();
        userRepository
            .Setup(r => r.GetRetiredByNormalizedEmailAsync("ALICE@EXAMPLE.COM", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ApplicationUser> { failingLookup, succeedingLookup });

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.NormalizeEmail("alice@example.com")).Returns("ALICE@EXAMPLE.COM");
        userManager
            .Setup(m => m.NormalizeEmail(It.Is<string>(e => e.StartsWith(RetiredUserAnonymization.EmailPrefix, StringComparison.Ordinal))))
            .Returns<string>(e => e.ToUpperInvariant());
        userManager.Setup(m => m.FindByIdAsync(failingId.ToString())).ReturnsAsync(failingTracked);
        userManager.Setup(m => m.FindByIdAsync(succeedingId.ToString())).ReturnsAsync(succeedingTracked);
        userManager
            .Setup(m => m.UpdateAsync(failingTracked))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "update failed" }));
        userManager
            .Setup(m => m.UpdateAsync(succeedingTracked))
            .ReturnsAsync(IdentityResult.Success);

        Mock<IAuditLogService> auditLogService = new();
        auditLogService
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserAnonymize",
                null,
                null,
                "User",
                succeedingId.ToString(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());

        UserLifecycleService sut = CreateSut(
            userManager: userManager,
            userRepository: userRepository,
            auditLogService: auditLogService,
            accountLifecycleOptions: Options.Create(new AccountLifecycleConfiguration
            {
                RetiredAnonymizationDays = 90
            }));

        Result result = await sut.TryAnonymizeStaleRetiredByEmailAsync("alice@example.com");

        Assert.True(result.IsSuccess);
        Assert.NotNull(succeedingTracked.AnonymizedOn);
        Assert.Equal(RetiredUserAnonymization.FormatEmail(succeedingId), succeedingTracked.Email);
        Assert.Equal(RetiredUserAnonymization.FirstName, succeedingTracked.FirstName);
        userManager.Verify(m => m.UpdateAsync(failingTracked), Times.Once);
        userManager.Verify(m => m.UpdateAsync(succeedingTracked), Times.Once);
        auditLogService.Verify(
            s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "UserAnonymize",
                null,
                null,
                "User",
                succeedingId.ToString(),
                It.IsAny<string>(),
                It.IsAny<string?>()),
            Times.Once);
    }

    private static UserLifecycleService CreateSut(
        Mock<UserManager<ApplicationUser>>? userManager = null,
        Mock<IUserRepository>? userRepository = null,
        Mock<IAuditLogService>? auditLogService = null,
        IOptions<AccountLifecycleConfiguration>? accountLifecycleOptions = null)
    {
        return new UserLifecycleService(
            NullLogger<UserLifecycleService>.Instance,
            (userManager ?? CreateUserManager()).Object,
            (userRepository ?? new Mock<IUserRepository>()).Object,
            new Mock<IAppRepository>().Object,
            new Mock<IDatabricksConnectionRepository>().Object,
            new Mock<ITenantAiModelRepository>().Object,
            new Mock<IUserTenantMembershipRepository>().Object,
            new Mock<IUserTenantPreferenceRepository>().Object,
            new Mock<ISubscriptionSeatRepository>().Object,
            new Mock<IRefreshTokenRepository>().Object,
            new Mock<IUserPlatformAiUsageRepository>().Object,
            new Mock<IDatabricksUserTokenRepository>().Object,
            new Mock<IAuditLogRepository>().Object,
            new Mock<ITenantRepository>().Object,
            (auditLogService ?? CreateSuccessfulAuditService()).Object,
            accountLifecycleOptions ?? Options.Create(new AccountLifecycleConfiguration()));
    }

    private static Mock<IAuditLogService> CreateSuccessfulAuditService()
    {
        Mock<IAuditLogService> audit = new();
        audit
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<Guid?>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());
        return audit;
    }

    private static Mock<UserManager<ApplicationUser>> CreateUserManager()
    {
        Mock<IUserStore<ApplicationUser>> store = new();
        return new Mock<UserManager<ApplicationUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
    }
}
