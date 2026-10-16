using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

public class IdentityControllerBetaRegistrationTests
{
    private readonly Mock<IAuthService> _authService = new();

    [Fact]
    public async Task RegisterBeta_ValidRequest_ReturnsOkWithEmail()
    {
        BetaRegisterRequest request = new()
        {
            Email = "beta@example.com",
            FirstName = "Beta",
            LastName = "User",
            Tier = SubscriptionTierNames.Individual,
            BetaCode = "VDAB-BETA-IND",
        };

        _authService
            .Setup(service => service.RegisterBetaAsync(request, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(request.Email));

        IdentityController controller = CreateController();

        ActionResult<string> response = await controller.RegisterBeta(request);

        OkObjectResult okResult = Assert.IsType<OkObjectResult>(response.Result);
        Assert.Equal(request.Email, okResult.Value);
    }

    [Fact]
    public async Task RegisterBeta_InvalidCode_ReturnsNotFound()
    {
        BetaRegisterRequest request = new()
        {
            Email = "beta@example.com",
            FirstName = "Beta",
            LastName = "User",
            Tier = SubscriptionTierNames.Individual,
            BetaCode = "UNKNOWN",
        };

        _authService
            .Setup(service => service.RegisterBetaAsync(request, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<string>(new NotFoundError("Beta code is invalid.")));

        IdentityController controller = CreateController();

        ActionResult<string> response = await controller.RegisterBeta(request);

        Assert.Equal(StatusCodes.Status404NotFound, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    private IdentityController CreateController()
    {
        IdentityController controller = new IdentityController(
            _authService.Object,
            Mock.Of<IVerificationChallengeService>(),
            Mock.Of<IPasswordLifecycleService>(),
            Mock.Of<ISessionTokenSecurityService>(),
            Mock.Of<IUserService>(),
            NullLogger<IdentityController>.Instance);

        controller.ControllerContext = ControllerTestHelpers.BuildContext(Guid.NewGuid(), tenantId: null);
        return controller;
    }
}
