using FluentResults;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

public class AuthServiceConfirmEmailChangeTests
{
    [Fact]
    public async Task ConfirmEmailChangeAsync_UpdatesEmailUsernameAndForceLogout()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            Email = "old@example.com",
            UserName = "old@example.com",
            IsActive = true,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        userManager
            .Setup(manager => manager.ChangeEmailAsync(user, "new@example.com", "token"))
            .ReturnsAsync(IdentityResult.Success);
        userManager
            .Setup(manager => manager.SetUserNameAsync(user, "new@example.com"))
            .ReturnsAsync(IdentityResult.Success);
        userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        Mock<ISessionTokenSecurityService> sessionSecurity = new();
        sessionSecurity
            .Setup(service => service.ForceLogoutAllDevicesAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        AuthService service = CreateAuthService(userManager, sessionSecurity.Object);

        Result result = await service.ConfirmEmailChangeAsync(userId, "new@example.com", "token");

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        userManager.Verify(
            manager => manager.ChangeEmailAsync(user, "new@example.com", "token"),
            Times.Once);
        userManager.Verify(
            manager => manager.SetUserNameAsync(user, "new@example.com"),
            Times.Once);
        sessionSecurity.Verify(
            service => service.ForceLogoutAllDevicesAsync(userId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

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

    private static AuthService CreateAuthService(
        Mock<UserManager<ApplicationUser>> userManager,
        ISessionTokenSecurityService sessionSecurity)
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
            Mock.Of<IAuthResponseService>(),
            sessionSecurity,
            new AccountAccessPolicy(),
            Options.Create(new AuthenticationConfiguration()));
    }
}
