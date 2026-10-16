using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

public class DatabricksConnectionControllerCreateTests
{
    private static DatabricksConnectionController CreateController(
        Mock<IDatabricksConnectionService> connectionService,
        Guid userId,
        Guid tenantId)
    {
        DatabricksConnectionController controller = new(
            connectionService.Object,
            Mock.Of<IDatabricksConnectionImportExportService>(),
            NullLogger<DatabricksConnectionController>.Instance)
        {
            ControllerContext = ControllerTestHelpers.BuildContext(userId, tenantId, AuthRoles.Developer),
        };

        return controller;
    }

    private static CreateDatabricksConnectionRequest BuildRequest()
    {
        return new CreateDatabricksConnectionRequest
        {
            WorkspaceUrl = "https://dbc.test.cloud.databricks.com",
            WorkspaceDisplayName = "Test Workspace",
            ClientId = "client-id",
        };
    }

    [Fact]
    public async Task Create_WhenServiceSucceeds_Returns200WithCreatedResource()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Mock<IDatabricksConnectionService> connectionService = new();
        DatabricksConnectionDto created = new()
        {
            PkId = 17,
            TenantId = tenantId,
            OwnerId = userId,
            WorkspaceUrl = "https://dbc.test.cloud.databricks.com",
            WorkspaceDisplayName = "Test Workspace",
            ClientId = "client-id",
        };

        connectionService
            .Setup(x => x.CreateConnectionAsync(
                It.IsAny<CreateDatabricksConnectionRequest>(),
                userId,
                tenantId))
            .ReturnsAsync(Result.Ok(created));

        DatabricksConnectionController controller = CreateController(connectionService, userId, tenantId);

        ActionResult<DatabricksConnectionDto> response = await controller.Create(BuildRequest());

        OkObjectResult okResult = Assert.IsType<OkObjectResult>(response.Result);
        Assert.Equal(StatusCodes.Status200OK, okResult.StatusCode);

        DatabricksConnectionDto body = Assert.IsType<DatabricksConnectionDto>(okResult.Value);
        Assert.Equal(17, body.PkId);
    }

    [Fact]
    public async Task Create_WhenServiceFailsWithConflict_Returns409()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Mock<IDatabricksConnectionService> connectionService = new();
        connectionService
            .Setup(x => x.CreateConnectionAsync(
                It.IsAny<CreateDatabricksConnectionRequest>(),
                userId,
                tenantId))
            .ReturnsAsync(Result.Fail<DatabricksConnectionDto>(
                new ConflictError("A workspace connection with this URL already exists for your tenant.")));

        DatabricksConnectionController controller = CreateController(connectionService, userId, tenantId);

        ActionResult<DatabricksConnectionDto> response = await controller.Create(BuildRequest());

        ObjectResult objectResult = Assert.IsType<ObjectResult>(response.Result);
        Assert.Equal(StatusCodes.Status409Conflict, objectResult.StatusCode);
    }

    [Fact]
    public async Task Create_WhenServiceFailsWithBadRequest_Returns400()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Mock<IDatabricksConnectionService> connectionService = new();
        connectionService
            .Setup(x => x.CreateConnectionAsync(
                It.IsAny<CreateDatabricksConnectionRequest>(),
                userId,
                tenantId))
            .ReturnsAsync(Result.Fail<DatabricksConnectionDto>(
                new BadRequestError("WorkspaceDisplayName is required.")));

        DatabricksConnectionController controller = CreateController(connectionService, userId, tenantId);

        ActionResult<DatabricksConnectionDto> response = await controller.Create(BuildRequest());

        ObjectResult objectResult = Assert.IsType<ObjectResult>(response.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, objectResult.StatusCode);
    }
}
