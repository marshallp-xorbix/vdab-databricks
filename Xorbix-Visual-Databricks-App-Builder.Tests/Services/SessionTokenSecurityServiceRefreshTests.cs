using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies <see cref="SessionTokenSecurityService.RefreshTokenAsync"/> uses
/// <see cref="IAccountAccessPolicy"/> before minting a new auth response.
/// </summary>
public class SessionTokenSecurityServiceRefreshTests
{
    private const string PresentedRefreshToken = "presented-refresh-token";

    private static Mock<UserManager<ApplicationUser>> CreateUserManagerMock() =>
        new(Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    private static RefreshToken CreateStoredRefreshToken(Guid userId) =>
        new()
        {
            UserId = userId,
            Token = "rotated-refresh-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
            SessionId = Guid.NewGuid(),
        };

    private static SessionTokenSecurityService CreateService(
        UserManager<ApplicationUser> userManager,
        IJwtService jwtService,
        IAuthResponseService authResponseService) =>
        new(
            NullLogger<SessionTokenSecurityService>.Instance,
            userManager,
            jwtService,
            authResponseService,
            new AccountAccessPolicy());

    [Fact]
    public async Task RefreshTokenAsync_WhenUserActive_ReturnsAuthResponse()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = true,
            DeletedOn = null,
            AnonymizedOn = null,
        };
        RefreshToken rotatedToken = CreateStoredRefreshToken(userId);
        AuthResponse expectedResponse = new()
        {
            AccessToken = "access",
            RefreshToken = rotatedToken.Token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IJwtService> jwtService = new();
        jwtService
            .Setup(service => service.RefreshAccessTokenAsync(
                PresentedRefreshToken,
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(("access", rotatedToken)));

        Mock<IAuthResponseService> authResponseService = new();
        authResponseService
            .Setup(service => service.GenerateAuthResponseAsync(
                user,
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<VerificationChallengeResponse?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(expectedResponse));

        SessionTokenSecurityService service = CreateService(
            userManager.Object,
            jwtService.Object,
            authResponseService.Object);

        Result<AuthResponse> result = await service.RefreshTokenAsync(PresentedRefreshToken);

        Assert.True(result.IsSuccess);
        Assert.Equal(expectedResponse.AccessToken, result.Value.AccessToken);
        authResponseService.Verify(
            service => service.GenerateAuthResponseAsync(
                user,
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<VerificationChallengeResponse?>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RefreshTokenAsync_WhenFailedRescueEncoding_ReturnsUnauthorizedAndDoesNotMint()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = true,
            DeletedOn = DateTime.UtcNow,
            AnonymizedOn = null,
        };
        RefreshToken rotatedToken = CreateStoredRefreshToken(userId);

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IJwtService> jwtService = new();
        jwtService
            .Setup(service => service.RefreshAccessTokenAsync(
                PresentedRefreshToken,
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(("access", rotatedToken)));

        Mock<IAuthResponseService> authResponseService = new();

        SessionTokenSecurityService service = CreateService(
            userManager.Object,
            jwtService.Object,
            authResponseService.Object);

        Result<AuthResponse> result = await service.RefreshTokenAsync(PresentedRefreshToken);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<UnauthorizedError>());
        authResponseService.Verify(
            service => service.GenerateAuthResponseAsync(
                It.IsAny<ApplicationUser>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<VerificationChallengeResponse?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RefreshTokenAsync_WhenAnonymized_ReturnsUnauthorizedAndDoesNotMint()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = true,
            DeletedOn = null,
            AnonymizedOn = DateTime.UtcNow,
        };
        RefreshToken rotatedToken = CreateStoredRefreshToken(userId);

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IJwtService> jwtService = new();
        jwtService
            .Setup(service => service.RefreshAccessTokenAsync(
                PresentedRefreshToken,
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(("access", rotatedToken)));

        Mock<IAuthResponseService> authResponseService = new();

        SessionTokenSecurityService service = CreateService(
            userManager.Object,
            jwtService.Object,
            authResponseService.Object);

        Result<AuthResponse> result = await service.RefreshTokenAsync(PresentedRefreshToken);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<UnauthorizedError>());
        authResponseService.Verify(
            service => service.GenerateAuthResponseAsync(
                It.IsAny<ApplicationUser>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<VerificationChallengeResponse?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
