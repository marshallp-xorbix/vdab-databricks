using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Tests.Server;
using IOFile = System.IO.File;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Named regression coverage for user-state model §9.3 invariants (Phase 5).
/// </summary>
public class UserStateModelInvariantTests
{
    [Fact]
    public void Invariant1_UserNameIndex_IsPartialUniqueOnLiveRowsOnly()
    {
        DbContextOptions<ApplicationDbContext> options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=invariant1_model_only;Username=x;Password=x")
            .Options;

        using ApplicationDbContext context = new(options);
        IEntityType? entity = context.Model.FindEntityType(typeof(ApplicationUser));
        Assert.NotNull(entity);

        IIndex index = entity!.GetIndexes().Single(i => i.GetDatabaseName() == "UserNameIndex");
        Assert.True(index.IsUnique);
        Assert.Equal("\"DeletedOn\" IS NULL", index.GetFilter());
    }

    [Fact]
    public void Invariant2_AccountAccessPolicy_RefusesDeletedAnonymizedAndSuspended()
    {
        AccountAccessPolicy policy = new();

        Assert.False(policy.CanAuthenticate(new ApplicationUser
        {
            Id = Guid.NewGuid(),
            IsActive = true,
            DeletedOn = DateTime.UtcNow,
        }));
        Assert.False(policy.CanAuthenticate(new ApplicationUser
        {
            Id = Guid.NewGuid(),
            IsActive = true,
            AnonymizedOn = DateTime.UtcNow,
        }));
        Assert.False(policy.CanAuthenticate(new ApplicationUser
        {
            Id = Guid.NewGuid(),
            IsActive = false,
            DeletedOn = null,
        }));
        Assert.True(policy.CanAuthenticate(new ApplicationUser
        {
            Id = Guid.NewGuid(),
            IsActive = true,
            DeletedOn = null,
            AnonymizedOn = null,
        }));
    }

    [Fact]
    public async Task Invariant2_RefreshToken_RefusesDeletedOnAndDoesNotMint()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = true,
            DeletedOn = DateTime.UtcNow,
            AnonymizedOn = null,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IJwtService> jwtService = new();
        jwtService
            .Setup(s => s.RefreshAccessTokenAsync(
                "presented",
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(("access", new RefreshToken
            {
                UserId = userId,
                Token = "rotated",
                ExpiresAt = DateTime.UtcNow.AddDays(1),
                CreatedAt = DateTime.UtcNow,
                SessionId = Guid.NewGuid(),
            })));

        Mock<IAuthResponseService> authResponseService = new();

        SessionTokenSecurityService sut = new(
            NullLogger<SessionTokenSecurityService>.Instance,
            userManager.Object,
            jwtService.Object,
            authResponseService.Object,
            new AccountAccessPolicy());

        Result<AuthResponse> result = await sut.RefreshTokenAsync("presented");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<UnauthorizedError>());
        authResponseService.Verify(
            s => s.GenerateAuthResponseAsync(
                It.IsAny<ApplicationUser>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<VerificationChallengeResponse?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public void Invariant3_TombstoneAwareUserStore_FindByEmailAndNameFilterDeletedOn_FindByIdUnfiltered()
    {
        // Behavioral pin without DB: store source must filter DeletedOn on email/name lookup
        // and must not override FindById (tombstones remain resolvable by id).
        // Live-DB coverage: TombstoneAwareUserStoreTests (RequiresDatabaseSchema).
        string path = FindRepoSourceFile("TombstoneAwareUserStore.cs");
        Assert.True(IOFile.Exists(path), $"Expected source at {path}");

        string source = IOFile.ReadAllText(path);
        Assert.Contains("FindByEmailAsync", source, StringComparison.Ordinal);
        Assert.Contains("FindByNameAsync", source, StringComparison.Ordinal);
        // FindByIdAsync may appear in XML docs; the store must not override it.
        Assert.DoesNotContain(
            "override Task<ApplicationUser?> FindByIdAsync",
            source,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "override async Task<ApplicationUser?> FindByIdAsync",
            source,
            StringComparison.Ordinal);

        int emailStart = source.IndexOf("public override Task<ApplicationUser?> FindByEmailAsync", StringComparison.Ordinal);
        int nameStart = source.IndexOf("public override Task<ApplicationUser?> FindByNameAsync", StringComparison.Ordinal);
        Assert.True(emailStart >= 0);
        Assert.True(nameStart > emailStart);

        string findByEmail = source[emailStart..nameStart];
        string findByName = source[nameStart..];
        Assert.Contains("user.DeletedOn == null", findByEmail, StringComparison.Ordinal);
        Assert.Contains("user.DeletedOn == null", findByName, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Invariant4_PersonalWorkspace_DoesNotClearDeletedOn()
    {
        Guid userId = Guid.NewGuid();
        DateTime deletedOn = DateTime.UtcNow.AddDays(-2);
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = false,
            DeletedOn = deletedOn,
            DeletedBy = Guid.NewGuid(),
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        PersonalWorkspaceService sut = new(
            NullLogger<PersonalWorkspaceService>.Instance,
            userManager.Object,
            Mock.Of<IUserTenantMembershipService>(),
            Mock.Of<ITenantService>(),
            new AccountAccessPolicy());

        Result<Models.DTOs.Tenant.TenantDto> result = await sut.CreatePersonalWorkspaceAsync(userId);

        Assert.True(result.IsFailed);
        Assert.Equal(deletedOn, user.DeletedOn);
        userManager.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task Invariant4_OnlyRestoreClearsDeletedOn()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = false,
            DeletedOn = DateTime.UtcNow.AddDays(-1),
            DeletedBy = Guid.NewGuid(),
            RetirementReason = AccountRetirementReason.Platform,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(m => m.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        Mock<IAuditLogService> audit = new();
        audit
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

        UserLifecycleService restoreSut = new(
            NullLogger<UserLifecycleService>.Instance,
            userManager.Object,
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
            audit.Object,
            Options.Create(new AccountLifecycleConfiguration()));

        Result result = await restoreSut.ReactivateUserAsync(userId, Guid.NewGuid());

        Assert.True(result.IsSuccess);
        Assert.Null(user.DeletedOn);
        Assert.True(user.IsActive);
    }

    [Fact]
    public async Task Invariant5_AddUserToTenant_OutsideReinstatementWindow_InsertsNewRow()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        UserTenantMembership ended = new()
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
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        repository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ended);

        UserTenantMembership? captured = null;
        repository
            .Setup(r => r.AddAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .Callback<UserTenantMembership, CancellationToken>((m, _) => captured = m)
            .ReturnsAsync((UserTenantMembership m, CancellationToken _) => m);

        UserTenantMembershipService sut = CreateMembershipService(
            repository,
            Options.Create(new AccountLifecycleConfiguration { MembershipReinstatementDays = 90 }));

        Result<UserTenantMembership> result =
            await sut.AddUserToTenantAsync(userId, tenantId, AuthRoles.Developer);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.NotNull(captured);
        Assert.Equal(MembershipStatus.Active, captured!.Status);
        repository.Verify(
            r => r.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()),
            Times.Never);
        repository.Verify(
            r => r.AddAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Invariant5_AddUserToTenant_WithinReinstatementWindow_ReactivatesExistingRow()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        UserTenantMembership ended = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.TenantAdmin,
            Status = MembershipStatus.Ended,
            DeletedOn = DateTime.UtcNow.AddDays(-10),
        };

        Mock<IUserTenantMembershipRepository> repository = new();
        repository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repository
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        repository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ended);
        repository
            .Setup(r => r.UpdateAsync(ended, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        UserTenantMembershipService sut = CreateMembershipService(
            repository,
            Options.Create(new AccountLifecycleConfiguration { MembershipReinstatementDays = 90 }));

        Result<UserTenantMembership> result =
            await sut.AddUserToTenantAsync(userId, tenantId, AuthRoles.Developer);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.Equal(MembershipStatus.Active, ended.Status);
        Assert.Null(ended.DeletedOn);
        // Reinstatement preserves the prior role; the requested invite/default role is ignored.
        Assert.Equal(AuthRoles.TenantAdmin, ended.Role);
        repository.Verify(
            r => r.AddAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()),
            Times.Never);
        repository.Verify(r => r.UpdateAsync(ended, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Invariant6_RemoveMember_LeavesUserRowUntouched()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();
        Guid originalTenantId = Guid.NewGuid();

        ApplicationUser user = new()
        {
            Id = userId,
            TenantId = originalTenantId,
            IsActive = true,
            Email = "member@example.com",
        };

        Mock<ITenantRepository> tenantRepository = new();
        tenantRepository
            .Setup(r => r.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Tenant
            {
                TenantId = tenantId,
                TenantName = "t",
                DisplayName = "T",
                IsActive = true,
            });

        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(s => s.GetUserRoleInTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));
        membershipService
            .Setup(s => s.RemoveUserFromTenantWithinTransactionAsync(
                userId, tenantId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        Mock<ISubscriptionSeatRepository> seatRepository = new();
        seatRepository
            .Setup(r => r.GetByUserAsync(tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubscriptionSeat?)null);

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<ITenantAccessRevocationService> revocation = new();
        revocation
            .Setup(s => s.RevokeAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Mock<IAuditLogService> audit = new();
        audit
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

        SeatManagementService sut = new(
            NullLogger<SeatManagementService>.Instance,
            seatRepository.Object,
            tenantRepository.Object,
            membershipService.Object,
            Mock.Of<ISubscriptionTierService>(),
            Mock.Of<IInternalDevTenantService>(),
            Mock.Of<IStripeClient>(),
            userManager.Object,
            revocation.Object,
            audit.Object);

        Result result = await sut.RemoveMemberAsync(tenantId, userId, performedBy);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.True(user.IsActive);
        Assert.Equal(originalTenantId, user.TenantId);
        Assert.Equal("member@example.com", user.Email);
        Assert.Null(user.DeletedOn);
        userManager.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task Invariant7_RestoreMembership_AuditFailure_DoesNotComplete()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        UserTenantMembership membership = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            Status = MembershipStatus.Ended,
            DeletedOn = DateTime.UtcNow.AddDays(-1),
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

        Mock<IAuditLogService> audit = new();
        audit
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
            .ReturnsAsync(Result.Fail("audit failed"));

        UserTenantMembershipService sut = new(
            NullLogger<UserTenantMembershipService>.Instance,
            repository.Object,
            Mock.Of<ISubscriptionSeatRepository>(),
            Mock.Of<ITenantInviteRepository>(),
            userManager.Object,
            audit.Object,
            Mock.Of<ITenantAccessRevocationService>(),
            Options.Create(new AccountLifecycleConfiguration()));

        Result<UserTenantMembership> result =
            await sut.RestoreMembershipAsync(userId, tenantId, Guid.NewGuid());

        Assert.True(result.IsFailed);
    }

    [Fact]
    public async Task Invariant8_CreateUser_UsesNewId_AndTriggersLazyAnonymizeWithoutReuse()
    {
        Guid newUserId = Guid.NewGuid();

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((ApplicationUser?)null);
        userManager
            .Setup(m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
            .ReturnsAsync((ApplicationUser u, string _) =>
            {
                u.Id = newUserId;
                return IdentityResult.Success;
            });
        userManager
            .Setup(m => m.AddToRolesAsync(It.IsAny<ApplicationUser>(), It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager
            .Setup(m => m.GetRolesAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync(new List<string> { AuthRoles.Developer });
        userManager
            .Setup(m => m.UpdateAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager
            .Setup(m => m.GenerateEmailConfirmationTokenAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync("token");

        Mock<IUserLifecycleService> lifecycle = new();
        lifecycle
            .Setup(s => s.TryAnonymizeStaleRetiredByEmailAsync("reuse@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        Mock<ITenantService> tenantService = new();
        tenantService
            .Setup(s => s.CreateTenantAsync(
                It.IsAny<Models.DTOs.Tenant.CreateTenantRequest>(),
                It.IsAny<Guid>(),
                true,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Models.DTOs.Tenant.TenantDto
            {
                TenantId = Guid.NewGuid(),
                TenantName = "t",
                DisplayName = "T",
                IsActive = true,
                SubscriptionTier = "Individual",
                BillingCycle = "Monthly",
                MaxUsers = 1,
                MaxPublishedApps = 1,
                MaxWorkspaceConnections = 1,
                AutoRenew = false,
                SubscriptionStatus = "incomplete",
            }));

        Mock<IUserTenantMembershipService> membershipService = new();

        UserProvisioningService sut = new(
            NullLogger<UserProvisioningService>.Instance,
            userManager.Object,
            Mock.Of<IEmailSenderService>(),
            tenantService.Object,
            membershipService.Object,
            Mock.Of<ISeatManagementService>(),
            lifecycle.Object,
            Options.Create(new PolicyConsentConfiguration()),
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = false }));

        Result<ApplicationUser> result = await sut.CreateUserAsync(new RegisterRequest
        {
            Email = "reuse@example.com",
            FirstName = "New",
            LastName = "Hire",
            Password = "Password1!",
        });

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.Equal(newUserId, result.Value.Id);
        Assert.Null(result.Value.TenantId);
        userManager.Verify(
            m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()),
            Times.Once);
        lifecycle.Verify(
            s => s.TryAnonymizeStaleRetiredByEmailAsync("reuse@example.com", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Invariant8_CreateUser_SucceedsWhenLazyAnonymizeFails()
    {
        Guid newUserId = Guid.NewGuid();

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((ApplicationUser?)null);
        userManager
            .Setup(m => m.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
            .ReturnsAsync((ApplicationUser u, string _) =>
            {
                u.Id = newUserId;
                return IdentityResult.Success;
            });
        userManager
            .Setup(m => m.AddToRolesAsync(It.IsAny<ApplicationUser>(), It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager
            .Setup(m => m.GetRolesAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync(new List<string> { AuthRoles.Developer });
        userManager
            .Setup(m => m.UpdateAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync(IdentityResult.Success);
        userManager
            .Setup(m => m.GenerateEmailConfirmationTokenAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync("token");

        Mock<IUserLifecycleService> lifecycle = new();
        lifecycle
            .Setup(s => s.TryAnonymizeStaleRetiredByEmailAsync("reuse@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new BadRequestError("anonymize failed")));

        Mock<ITenantService> tenantService = new();
        tenantService
            .Setup(s => s.CreateTenantAsync(
                It.IsAny<Models.DTOs.Tenant.CreateTenantRequest>(),
                It.IsAny<Guid>(),
                true,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Models.DTOs.Tenant.TenantDto
            {
                TenantId = Guid.NewGuid(),
                TenantName = "t",
                DisplayName = "T",
                IsActive = true,
                SubscriptionTier = "Individual",
                BillingCycle = "Monthly",
                MaxUsers = 1,
                MaxPublishedApps = 1,
                MaxWorkspaceConnections = 1,
                AutoRenew = false,
                SubscriptionStatus = "incomplete",
            }));

        UserProvisioningService sut = new(
            NullLogger<UserProvisioningService>.Instance,
            userManager.Object,
            Mock.Of<IEmailSenderService>(),
            tenantService.Object,
            Mock.Of<IUserTenantMembershipService>(),
            Mock.Of<ISeatManagementService>(),
            lifecycle.Object,
            Options.Create(new PolicyConsentConfiguration()),
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = false }));

        Result<ApplicationUser> result = await sut.CreateUserAsync(new RegisterRequest
        {
            Email = "reuse@example.com",
            FirstName = "New",
            LastName = "Hire",
            Password = "Password1!",
        });

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.Equal(newUserId, result.Value.Id);
        Assert.Null(result.Value.TenantId);
        lifecycle.Verify(
            s => s.TryAnonymizeStaleRetiredByEmailAsync("reuse@example.com", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Invariant9_TenantAccessRevocation_IsTenantScoped_AndRevokesDatabricksTokens()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        const int connectionId = 42;

        Mock<IRefreshTokenRepository> refreshTokens = new();
        Mock<IDatabricksConnectionRepository> connections = new();
        Mock<IDatabricksUserTokenRepository> databricksTokens = new();
        connections
            .Setup(r => r.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new DatabricksConnection
                {
                    PkId = connectionId,
                    TenantId = tenantId,
                    WorkspaceUrl = "https://example.databricks.com",
                    WorkspaceDisplayName = "ws",
                },
            ]);

        TenantAccessRevocationService sut = new(
            NullLogger<TenantAccessRevocationService>.Instance,
            refreshTokens.Object,
            connections.Object,
            databricksTokens.Object);

        await sut.RevokeAsync(userId, tenantId);

        refreshTokens.Verify(
            r => r.RevokeAllForUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
        refreshTokens.Verify(
            r => r.RevokeAllForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        databricksTokens.Verify(
            r => r.RevokeAsync(userId, connectionId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Invariant10_TenantAdmin_CannotUpdateOtherUserAccountFields()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        Mock<IUserService> userService = new();
        UserController controller = new(
            NullLogger<UserController>.Instance,
            userService.Object,
            Mock.Of<IUserProvisioningService>(),
            Mock.Of<IUserLifecycleService>(),
            Mock.Of<IUserSessionService>(),
            Mock.Of<ISessionTokenSecurityService>(),
            Mock.Of<IUserTenantMembershipService>(),
            Mock.Of<IAuthService>());
        controller.ControllerContext = ControllerTestHelpers.BuildContext(
            callerId,
            tenantId,
            AuthRoles.TenantAdmin);

        ActionResult<ApplicationUser> response = await controller.UpdateUser(
            targetId,
            new UpdateUserRequest { FirstName = "Ada", LastName = "Lovelace" });

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        userService.Verify(
            s => s.UpdateUserAsync(
                It.IsAny<Guid>(),
                It.IsAny<UpdateUserRequest>(),
                It.IsAny<Guid>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Invariant11_AcceptInvite_DoesNotWriteApplicationUserTenantIdOrAccountFields()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid otherHomeTenantId = Guid.NewGuid();
        const string email = "invitee@example.com";
        const string normalizedEmail = "INVITEE@EXAMPLE.COM";

        TenantInvite invite = new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = email,
            NormalizedEmail = normalizedEmail,
            TokenHash = "token-hash",
            TokenExpiresAt = DateTime.UtcNow.AddDays(1),
            Status = TenantInviteStatuses.Pending,
            InvitedByUserId = Guid.NewGuid(),
        };

        ApplicationUser user = new()
        {
            Id = userId,
            Email = email,
            NormalizedEmail = normalizedEmail,
            IsActive = true,
            DeletedOn = null,
            // Stale pointer must not be rewritten by invite accept (invariant 11).
            TenantId = otherHomeTenantId,
            FirstName = "Invitee",
            LastName = "User",
        };

        Mock<ITenantInviteRepository> inviteRepository = new();
        inviteRepository
            .Setup(r => r.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(invite);
        inviteRepository
            .Setup(r => r.UpdateAsync(invite, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Mock<ITenantRepository> tenantRepository = new();
        tenantRepository
            .Setup(r => r.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Tenant
            {
                TenantId = tenantId,
                TenantName = "acme",
                DisplayName = "Acme",
                SubscriptionTier = SubscriptionTierNames.Team,
                IsActive = true,
            });

        Mock<IUserTenantMembershipRepository> membershipRepository = new();
        membershipRepository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        membershipRepository
            .Setup(r => r.GetByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserTenantMembership
            {
                UserId = userId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                Status = MembershipStatus.Active,
            });
        membershipRepository
            .Setup(r => r.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());

        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(s => s.GetCurrentTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<UserTenantMembership?>(null));
        membershipService
            .Setup(s => s.SetDefaultTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        Mock<ISubscriptionSeatRepository> seatRepository = new();
        seatRepository
            .Setup(r => r.GetAvailableSeatsAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<SubscriptionSeat>());
        seatRepository
            .Setup(r => r.GetByUserAsync(tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SubscriptionSeat
            {
                SubscriptionSeatId = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Status = "Active",
            });

        Mock<ISubscriptionTierService> tierService = new();
        tierService.Setup(s => s.IsPerSeatTier(It.IsAny<string>())).Returns(true);

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManager();
        userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        TenantInviteService sut = new(
            NullLogger<TenantInviteService>.Instance,
            inviteRepository.Object,
            tenantRepository.Object,
            membershipRepository.Object,
            membershipService.Object,
            Mock.Of<ISeatManagementService>(),
            tierService.Object,
            Mock.Of<IInternalDevTenantService>(),
            seatRepository.Object,
            Mock.Of<IEmailSenderService>(),
            userManager.Object,
            Mock.Of<IUserProvisioningService>(),
            Mock.Of<IAuthResponseService>(),
            Mock.Of<IUserService>(),
            Options.Create(new TenantInviteConfiguration()),
            Options.Create(new AuthenticationConfiguration()));

        Result result = await sut.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.Equal(otherHomeTenantId, user.TenantId);
        Assert.True(user.IsActive);
        Assert.Null(user.DeletedOn);
        Assert.Equal("Invitee", user.FirstName);
        userManager.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        membershipService.Verify(
            s => s.SetDefaultTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static Mock<UserManager<ApplicationUser>> CreateUserManager() =>
        new(Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    /// <summary>
    /// Walks up from the test output directory until the DataAccess project source file is found
    /// (avoids brittle fixed <c>../../../../</c> depth).
    /// </summary>
    private static string FindRepoSourceFile(string fileName)
    {
        const string dataAccessProject = "Xorbix-Visual-Databricks-App-Builder.DataAccess";
        DirectoryInfo? directory = new(AppContext.BaseDirectory);
        while (directory is not null)
        {
            string candidate = Path.Combine(directory.FullName, dataAccessProject, fileName);
            if (IOFile.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        Assert.Fail($"Could not locate {dataAccessProject}/{fileName} by walking up from {AppContext.BaseDirectory}");
        return string.Empty;
    }

    private static UserTenantMembershipService CreateMembershipService(
        Mock<IUserTenantMembershipRepository> repository,
        IOptions<AccountLifecycleConfiguration>? lifecycleOptions = null)
    {
        Mock<IAuditLogService> audit = new();
        audit
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
            CreateUserManager().Object,
            audit.Object,
            Mock.Of<ITenantAccessRevocationService>(),
            lifecycleOptions ?? Options.Create(new AccountLifecycleConfiguration()));
    }
}
