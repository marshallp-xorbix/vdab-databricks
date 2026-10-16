using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

public class UserServiceChangeEmailTests
{
    private readonly Mock<UserManager<ApplicationUser>> _userManager = new(
        Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);
    private readonly Mock<IEmailSenderService> _emailSender = new();
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();

    [Fact]
    public async Task ChangeEmailAsync_IndividualSelfService_SendsBothEmails()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "old@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);
        SetupEmailChangeMocks(user, "new@example.com");

        UserService service = CreateService();
        Result result = await service.ChangeEmailAsync(userId, "new@example.com");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        _emailSender.Verify(
            sender => sender.SendEmailChangeNotificationAsync(
                user,
                "old@example.com",
                "new@example.com",
                It.IsAny<CancellationToken>()),
            Times.Once);
        _emailSender.Verify(
            sender => sender.SendEmailChangeConfirmationAsync(
                user,
                "new@example.com",
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Theory]
    [InlineData(SubscriptionTierNames.Team)]
    [InlineData(SubscriptionTierNames.Enterprise)]
    public async Task ChangeEmailAsync_RestrictedTierDeveloperSelfService_Succeeds(string tier)
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "dev@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, tier, AuthRoles.Developer);
        SetupEmailChangeMocks(user, "new@example.com");
        _userManager.Setup(manager => manager.GetRolesAsync(user)).ReturnsAsync([]);

        UserService service = CreateService();
        Result result = await service.ChangeEmailAsync(userId, "new@example.com");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        _emailSender.Verify(
            sender => sender.SendEmailChangeConfirmationAsync(
                user,
                "new@example.com",
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ChangeEmailAsync_TeamAdminSelfService_Succeeds()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "admin@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Team, AuthRoles.TenantAdmin);
        SetupEmailChangeMocks(user, "new@example.com");

        UserService service = CreateService();
        Result result = await service.ChangeEmailAsync(userId, "new@example.com");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
    }

    [Fact]
    public async Task ChangeEmailAsync_AdminInitiated_Succeeds()
    {
        Guid userId = Guid.NewGuid();
        Guid adminUserId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, Guid.NewGuid(), "member@example.com");
        SetupUserLookup(user);
        SetupEmailChangeMocks(user, "new@example.com");

        UserService service = CreateService();
        Result result = await service.ChangeEmailAsync(
            userId,
            "new@example.com",
            requestedByUserId: adminUserId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        _membershipService.Verify(
            service => service.GetUserTenantMembershipAsync(
                It.IsAny<Guid>(),
                It.IsAny<Guid>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ChangeEmailAsync_DuplicateEmail_ReturnsConflict()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "old@example.com");
        ApplicationUser existingUser = CreateUser(Guid.NewGuid(), Guid.NewGuid(), "taken@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);
        _userManager
            .Setup(manager => manager.FindByEmailAsync("taken@example.com"))
            .ReturnsAsync(existingUser);

        UserService service = CreateService();
        Result result = await service.ChangeEmailAsync(userId, "taken@example.com");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
    }

    [Fact]
    public async Task ChangeEmailAsync_NotificationFailure_StillSendsConfirmation()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "old@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);
        SetupEmailChangeMocks(user, "new@example.com");
        _emailSender
            .Setup(sender => sender.SendEmailChangeNotificationAsync(
                user,
                "old@example.com",
                "new@example.com",
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("ACS failure"));

        UserService service = CreateService();
        Result result = await service.ChangeEmailAsync(userId, "new@example.com");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        _emailSender.Verify(
            sender => sender.SendEmailChangeConfirmationAsync(
                user,
                "new@example.com",
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ChangeEmailAsync_SameEmail_ReturnsBadRequest()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "same@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);

        UserService service = CreateService();
        Result result = await service.ChangeEmailAsync(userId, "SAME@example.com");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
        _userManager.Verify(manager => manager.FindByEmailAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ChangeEmailAsync_SelfReferentialRequestedBy_SucceedsWithoutTierGate()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "dev@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Team, AuthRoles.Developer);
        SetupEmailChangeMocks(user, "new@example.com");
        _userManager.Setup(manager => manager.GetRolesAsync(user)).ReturnsAsync([]);

        UserService service = CreateService();
        Result result = await service.ChangeEmailAsync(
            userId,
            "new@example.com",
            requestedByUserId: userId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
    }

    [Fact]
    public async Task ChangeEmailAsync_PasswordBasedMissingPassword_ReturnsBadRequest()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "old@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);
        SetupPasswordBasedAccount(user);

        UserService service = CreateService(passwordlessOnly: false);
        Result result = await service.ChangeEmailAsync(userId, "new@example.com");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
    }

    [Fact]
    public async Task ChangeEmailAsync_PasswordBasedInvalidPassword_ReturnsUnauthorized()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "old@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);
        SetupPasswordBasedAccount(user);
        _userManager
            .Setup(manager => manager.CheckPasswordAsync(user, "wrong-password"))
            .ReturnsAsync(false);

        UserService service = CreateService(passwordlessOnly: false);
        Result result = await service.ChangeEmailAsync(userId, "new@example.com", "wrong-password");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<UnauthorizedError>());
    }

    [Fact]
    public async Task ChangeEmailAsync_PasswordBasedValidPassword_Succeeds()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "old@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);
        SetupEmailChangeMocks(user, "new@example.com");
        SetupPasswordBasedAccount(user);
        _userManager
            .Setup(manager => manager.CheckPasswordAsync(user, "correct-password"))
            .ReturnsAsync(true);

        UserService service = CreateService(passwordlessOnly: false);
        Result result = await service.ChangeEmailAsync(userId, "new@example.com", "correct-password");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
    }

    [Fact]
    public async Task ChangeEmailAsync_PasswordlessAccount_SucceedsWithoutPassword()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "old@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);
        SetupEmailChangeMocks(user, "new@example.com");
        _userManager.Setup(manager => manager.HasPasswordAsync(user)).ReturnsAsync(false);

        UserService service = CreateService(passwordlessOnly: false);
        Result result = await service.ChangeEmailAsync(userId, "new@example.com");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        _userManager.Verify(
            manager => manager.CheckPasswordAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task ChangeEmailAsync_AdminInitiatedOnSelfInPasswordMode_SucceedsWithoutPassword()
    {
        // An admin acting on their OWN account (requestedByUserId == userId) is authenticated by the
        // admin endpoint and never forwards a password; the password step-up must not apply even though
        // the account has a password. The tier gate still runs (Individual tier is allowed).
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = CreateUser(userId, tenantId, "old@example.com");
        SetupUserLookup(user);
        SetupMembership(userId, tenantId, SubscriptionTierNames.Individual, AuthRoles.Developer);
        SetupEmailChangeMocks(user, "new@example.com");
        SetupPasswordBasedAccount(user);

        UserService service = CreateService(passwordlessOnly: false);
        Result result = await service.ChangeEmailAsync(
            userId,
            "new@example.com",
            requestedByUserId: userId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        _userManager.Verify(
            manager => manager.CheckPasswordAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()),
            Times.Never);
    }

    private static ApplicationUser CreateUser(Guid userId, Guid tenantId, string email) =>
        new()
        {
            Id = userId,
            Email = email,
            UserName = email,
            TenantId = tenantId,
            IsActive = true,
        };

    private void SetupUserLookup(ApplicationUser user)
    {
        _userManager.Setup(manager => manager.FindByIdAsync(user.Id.ToString())).ReturnsAsync(user);
        _userManager.Setup(manager => manager.GetRolesAsync(user)).ReturnsAsync([]);
    }

    private void SetupEmailChangeMocks(ApplicationUser user, string newEmail)
    {
        _userManager
            .Setup(manager => manager.FindByEmailAsync(newEmail))
            .ReturnsAsync((ApplicationUser?)null);
        _userManager
            .Setup(manager => manager.GenerateChangeEmailTokenAsync(user, newEmail))
            .ReturnsAsync("change-token");
    }

    private void SetupPasswordBasedAccount(ApplicationUser user)
    {
        _userManager.Setup(manager => manager.HasPasswordAsync(user)).ReturnsAsync(true);
    }

    private void SetupMembership(
        Guid userId,
        Guid tenantId,
        string subscriptionTier,
        string tenantRole)
    {
        UserTenantMembership membership = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = tenantRole,
            Tenant = new Tenant
            {
                TenantId = tenantId,
                TenantName = "tenant",
                DisplayName = "Tenant",
                SubscriptionTier = subscriptionTier,
                IsActive = true,
            },
        };

        _membershipService
            .Setup(service => service.GetUserTenantMembershipAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(membership));
    }

    private UserService CreateService(bool passwordlessOnly = true) =>
        new(
            NullLogger<UserService>.Instance,
            _userManager.Object,
            Mock.Of<IUserRepository>(),
            Mock.Of<IRefreshTokenRepository>(),
            _emailSender.Object,
            _membershipService.Object,
            Mock.Of<ITenantRepository>(),
            Mock.Of<ITenantAccessRevocationService>(),
            Mock.Of<IBillingService>(),
            Mock.Of<IBetaCodeRepository>(),
            Mock.Of<IInternalDevTenantService>(),
            Options.Create(new PolicyConsentConfiguration()),
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = passwordlessOnly }),
            Mock.Of<IAuditLogService>());
}
