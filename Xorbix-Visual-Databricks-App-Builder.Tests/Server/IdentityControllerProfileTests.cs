using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

public class IdentityControllerProfileTests
{
    [Fact]
    public async Task GetCurrentUser_PassesJwtTenantContextToUserService()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        const string tenantRole = AuthRoles.TenantAdmin;

        Mock<IUserService> userService = new();
        userService
            .Setup(service => service.GetCurrentUserProfileAsync(
                userId,
                tenantId,
                tenantRole,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserProfileResponse
            {
                UserId = userId,
                UserName = "user@test.com",
                Email = "user@test.com",
                FirstName = "Test",
                LastName = "User",
                Roles = [],
                TenantId = tenantId,
                TenantRole = tenantRole,
            }));

        IdentityController controller = CreateController(userService.Object);
        controller.ControllerContext = ControllerTestHelpers.BuildContextWithTenantRole(
            userId,
            tenantId,
            tenantRole);

        ActionResult<UserProfileResponse> response = await controller.GetCurrentUser();

        OkObjectResult? okResult = response.Result as OkObjectResult;
        Assert.NotNull(okResult);
        UserProfileResponse? profile = okResult.Value as UserProfileResponse;
        Assert.NotNull(profile);
        Assert.Equal(tenantId, profile.TenantId);
        Assert.Equal(tenantRole, profile.TenantRole);

        userService.Verify(
            service => service.GetCurrentUserProfileAsync(
                userId,
                tenantId,
                tenantRole,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static IdentityController CreateController(IUserService userService)
    {
        return new IdentityController(
            Mock.Of<IAuthService>(),
            Mock.Of<IVerificationChallengeService>(),
            Mock.Of<IPasswordLifecycleService>(),
            Mock.Of<ISessionTokenSecurityService>(),
            userService,
            NullLogger<IdentityController>.Instance);
    }
}
