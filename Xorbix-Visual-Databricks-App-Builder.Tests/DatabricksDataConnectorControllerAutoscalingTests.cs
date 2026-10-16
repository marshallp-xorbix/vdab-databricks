using System.Security.Claims;
using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class DatabricksDataConnectorControllerAutoscalingTests
{
    [Fact]
    public async Task GetLakebaseAutoscalingSelector_ReturnsBadRequest_WhenWorkspaceConnectionIdInvalid()
    {
        Mock<IDatabricksDataConnectorService> service = new();
        DatabricksDataConnectorController sut = CreateController(service.Object, Guid.NewGuid(), Guid.NewGuid());

        IActionResult actionResult = await sut.GetLakebaseAutoscalingSelector(0);

        BadRequestObjectResult badRequest = Assert.IsType<BadRequestObjectResult>(actionResult);
        Assert.Equal("Workspace connection ID is required", badRequest.Value);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelector_ReturnsUnauthorized_WhenUserMissing()
    {
        Mock<IDatabricksDataConnectorService> service = new();
        DatabricksDataConnectorController sut = CreateController(service.Object, null, null);

        IActionResult actionResult = await sut.GetLakebaseAutoscalingSelector(12);

        Assert.IsType<UnauthorizedResult>(actionResult);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelector_ReturnsOk_WhenServiceSucceeds()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        LakebaseAutoscalingSelectorResponse payload = new()
        {
            Projects =
            [
                new LakebaseAutoscalingProjectOption
                {
                    ProjectName = "projects/vdab-autoscale-lakebase",
                    ProjectId = "vdab-autoscale-lakebase",
                    DisplayName = "VDAB Autoscale Lakebase",
                },
            ],
        };

        Mock<IDatabricksDataConnectorService> service = new();
        service
            .Setup(x => x.GetLakebaseAutoscalingSelectorAsync(userId, tenantId, 12))
            .ReturnsAsync(Result.Ok(payload));

        DatabricksDataConnectorController sut = CreateController(service.Object, userId, tenantId);

        IActionResult actionResult = await sut.GetLakebaseAutoscalingSelector(12);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(actionResult);
        LakebaseAutoscalingSelectorResponse body = Assert.IsType<LakebaseAutoscalingSelectorResponse>(ok.Value);
        Assert.Single(body.Projects);
    }

    [Fact]
    public async Task GetLakebaseAutoscalingSelector_ReturnsProblemDetails_WhenServiceFails()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IDatabricksDataConnectorService> service = new();
        service
            .Setup(x => x.GetLakebaseAutoscalingSelectorAsync(userId, tenantId, 12))
            .ReturnsAsync(Result.Fail<LakebaseAutoscalingSelectorResponse>(new UpstreamDependencyError("Databricks upstream failed")));

        DatabricksDataConnectorController sut = CreateController(service.Object, userId, tenantId);

        IActionResult actionResult = await sut.GetLakebaseAutoscalingSelector(12);

        ObjectResult objectResult = Assert.IsType<ObjectResult>(actionResult);
        Assert.Equal(StatusCodes.Status502BadGateway, objectResult.StatusCode);
        ProblemDetails problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal("Databricks upstream failed", problem.Detail);
    }

    private static DatabricksDataConnectorController CreateController(
        IDatabricksDataConnectorService service,
        Guid? userId,
        Guid? tenantId)
    {
        DatabricksDataConnectorController controller = new(
            service,
            NullLogger<DatabricksDataConnectorController>.Instance);

        DefaultHttpContext httpContext = new();
        if (userId.HasValue)
        {
            Claim[] claims =
            [
                new(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                new(TenantClaimTypes.TenantId, tenantId?.ToString() ?? string.Empty)
            ];
            ClaimsIdentity identity = new(claims, "test");
            httpContext.User = new ClaimsPrincipal(identity);
        }
        else
        {
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity());
        }

        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
        return controller;
    }
}
