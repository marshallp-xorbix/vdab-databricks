using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies JWT access-token minting rejects users without a security stamp.
/// </summary>
public class JwtServiceGenerateAccessTokenTests
{
    private static Mock<UserManager<ApplicationUser>> CreateUserManagerMock() =>
        new(Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    private static JwtService CreateService() =>
        new(
            Options.Create(new JwtConfiguration
            {
                SecretKey = "unit-test-secret-key-at-least-32-chars!",
                Issuer = "test-issuer",
                Audience = "test-audience",
                ExpirationMinutes = 15,
            }),
            NullLogger<JwtService>.Instance,
            Mock.Of<IRefreshTokenRepository>(),
            CreateUserManagerMock().Object,
            Mock.Of<IGeoLocationService>());

    [Fact]
    public async Task GenerateAccessTokenAsync_WhenSecurityStampMissing_ReturnsFailure()
    {
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            UserName = "user@example.com",
            Email = "user@example.com",
            FirstName = "Test",
            LastName = "User",
            SecurityStamp = null,
        };

        JwtService service = CreateService();

        Result<string> result = await service.GenerateAccessTokenAsync(
            user,
            roles: [],
            sessionId: Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.Contains("Failed to generate access token", result.Errors[0].Message);
    }

    [Fact]
    public async Task GenerateAccessTokenAsync_WhenSecurityStampPresent_ReturnsToken()
    {
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            UserName = "user@example.com",
            Email = "user@example.com",
            FirstName = "Test",
            LastName = "User",
            SecurityStamp = "stamp-abc",
        };

        JwtService service = CreateService();

        Result<string> result = await service.GenerateAccessTokenAsync(
            user,
            roles: ["Developer"],
            sessionId: Guid.NewGuid());

        Assert.True(result.IsSuccess);
        Assert.False(string.IsNullOrWhiteSpace(result.Value));
    }
}
