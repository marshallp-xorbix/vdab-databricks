using FluentResults;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies that passwordless-only mode is enforced server-side: password sign-in and password-lifecycle
/// operations are rejected, user-settings updates pin the login method and 2FA on, and email confirmation
/// signs the user in immediately.
/// </summary>
public class PasswordlessOnlyEnforcementTests
{
    private static Mock<UserManager<ApplicationUser>> CreateUserManagerMock() =>
        new(Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    private static Mock<SignInManager<ApplicationUser>> CreateSignInManagerMock(
        UserManager<ApplicationUser> userManager) =>
        new(
            userManager,
            Mock.Of<IHttpContextAccessor>(),
            Mock.Of<IUserClaimsPrincipalFactory<ApplicationUser>>(),
            Options.Create(new IdentityOptions()),
            NullLogger<SignInManager<ApplicationUser>>.Instance,
            Mock.Of<IAuthenticationSchemeProvider>(),
            Mock.Of<IUserConfirmation<ApplicationUser>>());

    private static IOptions<AuthenticationConfiguration> AuthOptions(bool passwordlessOnly) =>
        Options.Create(new AuthenticationConfiguration { PasswordlessOnly = passwordlessOnly });

    // ----- AuthService.LoginAsync -----

    [Fact]
    public async Task LoginAsync_WhenPasswordlessOnly_ReturnsForbiddenWithoutTouchingUserStore()
    {
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        AuthService service = CreateAuthService(userManager, passwordlessOnly: true);

        Result<AuthResponse> result = await service.LoginAsync("user@example.com", "Password123!");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
        userManager.Verify(
            manager => manager.FindByEmailAsync(It.IsAny<string>()),
            Times.Never);
    }

    // ----- AuthService.ConfirmEmailAsync -----

    [Fact]
    public async Task ConfirmEmailAsync_WhenPasswordlessOnly_IssuesAuthResponseForImmediateSignIn()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            Email = "new@example.com",
            UserName = "new@example.com",
            IsActive = true,
            EmailConfirmed = false,
            UsePasswordlessLogin = true,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(manager => manager.ConfirmEmailAsync(user, "token")).ReturnsAsync(IdentityResult.Success);
        userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        AuthResponse expectedAuthResponse = new()
        {
            AccessToken = "access",
            RefreshToken = "refresh",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            User = new UserInfo
            {
                UserId = userId,
                UserName = user.UserName!,
                Email = user.Email!,
                FirstName = "New",
                LastName = "User",
                Roles = [],
            },
        };

        Mock<IAuthResponseService> authResponseService = new();
        authResponseService
            .Setup(responseService => responseService.GenerateAuthResponseAsync(
                user, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<VerificationChallengeResponse?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(expectedAuthResponse));

        AuthService service = CreateAuthService(userManager, passwordlessOnly: true, authResponseService: authResponseService);

        Result<ConfirmEmailResponse> result = await service.ConfirmEmailAsync(userId, "token");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.NotNull(result.Value.AuthResponse);
        Assert.Equal("access", result.Value.AuthResponse!.AccessToken);
        Assert.False(result.Value.RequiresPasswordSetup);
    }

    [Fact]
    public async Task ConfirmEmailAsync_WhenPasswordBased_DoesNotIssueAuthResponse()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            Email = "new@example.com",
            UserName = "new@example.com",
            IsActive = true,
            EmailConfirmed = false,
            UsePasswordlessLogin = false,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(manager => manager.ConfirmEmailAsync(user, "token")).ReturnsAsync(IdentityResult.Success);
        userManager.Setup(manager => manager.HasPasswordAsync(user)).ReturnsAsync(false);
        userManager.Setup(manager => manager.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("reset-token");

        AuthService service = CreateAuthService(userManager, passwordlessOnly: false);

        Result<ConfirmEmailResponse> result = await service.ConfirmEmailAsync(userId, "token");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.Null(result.Value.AuthResponse);
        Assert.True(result.Value.RequiresPasswordSetup);
    }

    // ----- PasswordLifecycleService -----

    [Fact]
    public async Task ChangePasswordAsync_WhenPasswordlessOnly_ReturnsForbidden()
    {
        PasswordLifecycleService service = CreatePasswordLifecycleService(passwordlessOnly: true, out _);

        Result result = await service.ChangePasswordAsync(Guid.NewGuid(), "Old123!", "New123!");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }

    [Fact]
    public async Task ForgotPasswordAsync_WhenPasswordlessOnly_ReturnsForbidden()
    {
        PasswordLifecycleService service = CreatePasswordLifecycleService(passwordlessOnly: true, out _);

        Result result = await service.ForgotPasswordAsync("user@example.com");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }

    [Fact]
    public async Task ResetPasswordAsync_WhenPasswordlessOnly_ReturnsForbidden()
    {
        Guid userId = Guid.NewGuid();
        PasswordLifecycleService service =
            CreatePasswordLifecycleService(passwordlessOnly: true, out Mock<UserManager<ApplicationUser>> userManager);
        userManager
            .Setup(manager => manager.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = userId, IsActive = true });

        Result result = await service.ResetPasswordAsync(userId, "token", "New123!");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }

    // ----- UserService.UpdateUserSettingsAsync -----

    [Fact]
    public async Task UpdateUserSettingsAsync_WhenPasswordlessOnly_ForcesPasswordlessAndTwoFactorOn()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new() { Id = userId, IsActive = true };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        UserService service = CreateUserService(userManager, passwordlessOnly: true);

        UpdateUserSettingsRequest request = new()
        {
            UsePasswordlessLogin = false,
            TwoFactorEnabled = false,
            EmailNotificationsEnabled = true,
            WorkflowNotificationsEnabled = false,
        };

        Result<ApplicationUser> result = await service.UpdateUserSettingsAsync(userId, request, userId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(result.Value.UsePasswordlessLogin);
        Assert.True(result.Value.TwoFactorEnabled);
        Assert.True(result.Value.EmailNotificationsEnabled);
        Assert.False(result.Value.WorkflowNotificationsEnabled);
    }

    [Fact]
    public async Task UpdateUserSettingsAsync_WhenPasswordBased_RespectsRequestedValues()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new() { Id = userId, IsActive = true };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        UserService service = CreateUserService(userManager, passwordlessOnly: false);

        UpdateUserSettingsRequest request = new()
        {
            UsePasswordlessLogin = false,
            TwoFactorEnabled = false,
            EmailNotificationsEnabled = true,
            WorkflowNotificationsEnabled = true,
        };

        Result<ApplicationUser> result = await service.UpdateUserSettingsAsync(userId, request, userId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.False(result.Value.UsePasswordlessLogin);
        Assert.False(result.Value.TwoFactorEnabled);
    }

    // ----- Service factories -----

    private static AuthService CreateAuthService(
        Mock<UserManager<ApplicationUser>> userManager,
        bool passwordlessOnly,
        Mock<IAuthResponseService>? authResponseService = null)
    {
        Mock<SignInManager<ApplicationUser>> signInManager = CreateSignInManagerMock(userManager.Object);

        return new AuthService(
            NullLogger<AuthService>.Instance,
            userManager.Object,
            signInManager.Object,
            Mock.Of<IEmailSenderService>(),
            Mock.Of<IUserTenantMembershipService>(),
            Mock.Of<IUserProvisioningService>(),
            Mock.Of<IBetaCodeService>(),
            Mock.Of<IVerificationChallengeService>(),
            (authResponseService ?? new Mock<IAuthResponseService>()).Object,
            Mock.Of<ISessionTokenSecurityService>(),
            new AccountAccessPolicy(),
            AuthOptions(passwordlessOnly));
    }

    private static PasswordLifecycleService CreatePasswordLifecycleService(
        bool passwordlessOnly,
        out Mock<UserManager<ApplicationUser>> userManager)
    {
        userManager = CreateUserManagerMock();

        IOptions<ApplicationConfiguration> appConfig =
            Options.Create(new ApplicationConfiguration
            {
                AllowedOrigins = "*",
                FrontendUrl = "https://example.test",
            });

        return new PasswordLifecycleService(
            NullLogger<PasswordLifecycleService>.Instance,
            userManager.Object,
            Mock.Of<IEmailSenderService>(),
            Mock.Of<IJwtService>(),
            appConfig,
            AuthOptions(passwordlessOnly));
    }

    private static UserService CreateUserService(
        Mock<UserManager<ApplicationUser>> userManager,
        bool passwordlessOnly)
    {
        return new UserService(
            NullLogger<UserService>.Instance,
            userManager.Object,
            Mock.Of<IUserRepository>(),
            Mock.Of<IRefreshTokenRepository>(),
            Mock.Of<IEmailSenderService>(),
            Mock.Of<IUserTenantMembershipService>(),
            Mock.Of<ITenantRepository>(),
            Mock.Of<ITenantAccessRevocationService>(),
            Mock.Of<IBillingService>(),
            Mock.Of<IBetaCodeRepository>(),
            Mock.Of<IInternalDevTenantService>(),
            Options.Create(new PolicyConsentConfiguration()),
            AuthOptions(passwordlessOnly),
            Mock.Of<IAuditLogService>());
    }
}
