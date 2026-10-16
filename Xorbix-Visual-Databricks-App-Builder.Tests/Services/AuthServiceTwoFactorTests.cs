using FluentResults;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies AuthService.LoginAsync's 2FA seam: when a password-verified <c>TwoFactorEnabled</c> user's
/// PasswordVerified issuance bucket is throttled, the <see cref="TooManyRequestsError"/> from the 2FA
/// send propagates out of login (the controller maps it to 429) rather than being swallowed or masked
/// as invalid credentials.
/// </summary>
public class AuthServiceTwoFactorTests
{
    private const string Email = "user@example.com";
    private const string Password = "Password123!";

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

    private static ApplicationUser TwoFactorUser() =>
        new()
        {
            Id = Guid.NewGuid(),
            Email = Email,
            UserName = Email,
            IsActive = true,
            EmailConfirmed = true,
            TwoFactorEnabled = true,
        };

    [Fact]
    public async Task LoginAsync_WhenTwoFactorSendIsThrottled_PropagatesTooManyRequests()
    {
        ApplicationUser user = TwoFactorUser();

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(user);

        // The password check succeeds, so login proceeds to issue the 2FA code.
        Mock<SignInManager<ApplicationUser>> signInManager = CreateSignInManagerMock(userManager.Object);
        signInManager
            .Setup(manager => manager.CheckPasswordSignInAsync(user, Password, true))
            .ReturnsAsync(SignInResult.Success);

        // ...but the PasswordVerified issuance bucket is inside its backoff, so the send is throttled.
        Mock<IVerificationChallengeService> challengeService = new();
        challengeService
            .Setup(service => service.SendVerificationCodeAsync(
                Email, VerificationIssuanceScope.PasswordVerified, user, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<VerificationChallengeResponse>(
                new TooManyRequestsError("Too many verification code requests.", DateTime.UtcNow.AddMinutes(2))));

        AuthService service = CreateAuthService(userManager, signInManager, challengeService);

        Result<AuthResponse> result = await service.LoginAsync(Email, Password);

        // The throttle error must survive the non-generic Result -> Result<AuthResponse> propagation seam,
        // so the controller can map it to 429 rather than a misleading credentials failure.
        Assert.True(result.IsFailed);
        Assert.True(result.HasError<TooManyRequestsError>());
    }

    private static AuthService CreateAuthService(
        Mock<UserManager<ApplicationUser>> userManager,
        Mock<SignInManager<ApplicationUser>> signInManager,
        Mock<IVerificationChallengeService> challengeService)
    {
        return new(
            NullLogger<AuthService>.Instance,
            userManager.Object,
            signInManager.Object,
            Mock.Of<IEmailSenderService>(),
            Mock.Of<IUserTenantMembershipService>(),
            Mock.Of<IUserProvisioningService>(),
            Mock.Of<IBetaCodeService>(),
            challengeService.Object,
            new Mock<IAuthResponseService>().Object,
            Mock.Of<ISessionTokenSecurityService>(),
            new AccountAccessPolicy(),
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = false }));
    }
}
