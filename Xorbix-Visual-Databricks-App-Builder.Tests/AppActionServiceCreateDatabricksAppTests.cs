using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class AppActionServiceCreateDatabricksAppTests
{
    [Fact]
    public async Task CreateDatabricksAppAsync_ReturnsCanonicalNameOnSuccess()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();
        Mock<IDatabricksAppProvisioningService> provisioning = new();
        provisioning
            .Setup(x => x.CreateDatabricksAppAsync(
                userId,
                It.IsAny<string>(),
                5,
                "my-databricks-app",
                null,
                null,
                It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(new CreatedDatabricksAppDto
            {
                Name = "my-databricks-app",
                UpdateTime = "2024-01-01T00:00:00Z",
                Url = "https://dbc.test/apps/my-databricks-app",
            }));

        Mock<IAppService> appService = new();

        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator = new();
        workspaceValidator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Ok(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test.cloud.databricks.com",
                WorkspaceDisplayName = "Test",
            }));

        AppActionService sut = new AppActionService(
            databricksApi.Object,
            NullLogger<AppActionService>.Instance,
            appService.Object,
            workspaceValidator.Object,
            provisioning.Object);

        CreateDatabricksAppRequestDto request = new CreateDatabricksAppRequestDto
        {
            WorkspaceConnectionId = 5,
            Name = "my-databricks-app",
        };

        Result<CreatedDatabricksAppDto> result = await sut.CreateDatabricksAppAsync(userId, tenantId, request);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("my-databricks-app", result.Value.Name);
        Assert.Equal("2024-01-01T00:00:00Z", result.Value.UpdateTime);
        Assert.Equal("https://dbc.test/apps/my-databricks-app", result.Value.Url);
    }

    [Fact]
    public async Task CreateDatabricksAppAsync_DoesNotCallDatabricksWhenConnectionTenantMismatch()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid otherTenant = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();
        Mock<IDatabricksAppProvisioningService> provisioning = new();

        Mock<IAppService> appService = new();

        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator = new();
        workspaceValidator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Fail<DatabricksConnection>(
                new BadRequestError($"Workspace is not available for tenant {otherTenant}")));

        AppActionService sut = new AppActionService(
            databricksApi.Object,
            NullLogger<AppActionService>.Instance,
            appService.Object,
            workspaceValidator.Object,
            provisioning.Object);

        CreateDatabricksAppRequestDto request = new CreateDatabricksAppRequestDto
        {
            WorkspaceConnectionId = 5,
            Name = "app-name",
        };

        Result<CreatedDatabricksAppDto> result = await sut.CreateDatabricksAppAsync(userId, tenantId, request);

        Assert.True(result.IsFailed);
        provisioning.Verify(
            x => x.CreateDatabricksAppAsync(
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<List<DatabricksAppResource>?>(),
                It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateDatabricksAppAsync_ReturnsUpstreamErrorWhenPostFails()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();
        Mock<IDatabricksAppProvisioningService> provisioning = new();
        provisioning
            .Setup(x => x.CreateDatabricksAppAsync(
                userId,
                It.IsAny<string>(),
                5,
                "app-name",
                null,
                null,
                It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<CreatedDatabricksAppDto>(new UpstreamDependencyError("Databricks said no")));

        Mock<IAppService> appService = new();

        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator = new();
        workspaceValidator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Ok(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test.cloud.databricks.com",
                WorkspaceDisplayName = "Test",
            }));

        AppActionService sut = new AppActionService(
            databricksApi.Object,
            NullLogger<AppActionService>.Instance,
            appService.Object,
            workspaceValidator.Object,
            provisioning.Object);

        CreateDatabricksAppRequestDto request = new CreateDatabricksAppRequestDto
        {
            WorkspaceConnectionId = 5,
            Name = "app-name",
        };

        Result<CreatedDatabricksAppDto> result = await sut.CreateDatabricksAppAsync(userId, tenantId, request);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<UpstreamDependencyError>());
    }
}
