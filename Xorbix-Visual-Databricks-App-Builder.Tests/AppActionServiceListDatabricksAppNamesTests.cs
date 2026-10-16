using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class AppActionServiceListDatabricksAppNamesTests
{
    private static AppActionService CreateSut(
        Mock<IDatabricksApiService> databricksApi,
        Mock<IAppService> appService,
        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator)
    {
        Mock<IDatabricksAppProvisioningService> provisioning = new();
        return new AppActionService(
            databricksApi.Object,
            NullLogger<AppActionService>.Instance,
            appService.Object,
            workspaceValidator.Object,
            provisioning.Object);
    }

    [Fact]
    public async Task ListDatabricksAppNamesAsync_MergesPagesAndSortsCaseInsensitive()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .SetupSequence(x => x.GetAsync<DatabricksAppsListPage>(
                userId,
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<System.Text.Json.JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok(new DatabricksAppsListPage
            {
                Apps = new List<DatabricksAppListItem>
                {
                    new() { Name = "zebra" },
                    new() { Name = "alpha" },
                },
                NextPageToken = "t1",
            }))
            .ReturnsAsync(Result.Ok(new DatabricksAppsListPage
            {
                Apps = new List<DatabricksAppListItem>
                {
                    new() { Name = "Beta" },
                },
                NextPageToken = null,
            }));

        Mock<IAppService> appService = new();
        appService
            .Setup(x => x.GetAppByIdAsync(It.IsAny<int>(), tenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                Id = 1,
                AppName = "Local",
                TenantId = tenantId,
                WorkspaceConnectionId = 5,
                OwnerId = userId,
                WorkflowDefinition = "{}",
            }));

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

        AppActionService sut = CreateSut(databricksApi, appService, workspaceValidator);

        Result<DatabricksAppNamesResponseDto> result =
            await sut.ListDatabricksAppNamesAsync(userId, tenantId, 1, 5);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(new[] { "alpha", "Beta", "zebra" }, result.Value.AppNames);
    }

    [Fact]
    public async Task ListDatabricksAppNamesAsync_FailsWhenConnectionTenantMismatch()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid otherTenant = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();

        Mock<IAppService> appService = new();
        appService
            .Setup(x => x.GetAppByIdAsync(1, tenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                Id = 1,
                AppName = "Local",
                TenantId = tenantId,
                WorkspaceConnectionId = 5,
                OwnerId = userId,
                WorkflowDefinition = "{}",
            }));

        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator = new();
        workspaceValidator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Fail<DatabricksConnection>(
                new BadRequestError($"Workspace is not available for tenant {otherTenant}")));

        AppActionService sut = CreateSut(databricksApi, appService, workspaceValidator);

        Result<DatabricksAppNamesResponseDto> result =
            await sut.ListDatabricksAppNamesAsync(userId, tenantId, 1, 5);

        Assert.True(result.IsFailed);
    }

    [Fact]
    public async Task ListDatabricksAppNamesForWorkspaceAsync_MergesPagesAndSortsCaseInsensitive()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .SetupSequence(x => x.GetAsync<DatabricksAppsListPage>(
                userId,
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<System.Text.Json.JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok(new DatabricksAppsListPage
            {
                Apps = new List<DatabricksAppListItem>
                {
                    new() { Name = "zebra" },
                    new() { Name = "alpha" },
                },
                NextPageToken = "t1",
            }))
            .ReturnsAsync(Result.Ok(new DatabricksAppsListPage
            {
                Apps = new List<DatabricksAppListItem>
                {
                    new() { Name = "Beta" },
                },
                NextPageToken = null,
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

        AppActionService sut = CreateSut(databricksApi, appService, workspaceValidator);

        Result<DatabricksAppNamesResponseDto> result =
            await sut.ListDatabricksAppNamesForWorkspaceAsync(userId, tenantId, 5);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(new[] { "alpha", "Beta", "zebra" }, result.Value.AppNames);
    }

    [Fact]
    public async Task ListDatabricksAppNamesForWorkspaceAsync_FailsWhenConnectionTenantMismatch()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid otherTenant = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();
        Mock<IAppService> appService = new();

        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator = new();
        workspaceValidator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Fail<DatabricksConnection>(
                new BadRequestError($"Workspace is not available for tenant {otherTenant}")));

        AppActionService sut = CreateSut(databricksApi, appService, workspaceValidator);

        Result<DatabricksAppNamesResponseDto> result =
            await sut.ListDatabricksAppNamesForWorkspaceAsync(userId, tenantId, 5);

        Assert.True(result.IsFailed);
    }

    [Fact]
    public async Task ListDatabricksAppNamesForWorkspaceAsync_FailsWhenConnectionNotFound()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();
        Mock<IAppService> appService = new();

        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator = new();
        workspaceValidator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 99))
            .ReturnsAsync(Result.Fail<DatabricksConnection>(new BadRequestError("Workspace connection not found.")));

        AppActionService sut = CreateSut(databricksApi, appService, workspaceValidator);

        Result<DatabricksAppNamesResponseDto> result =
            await sut.ListDatabricksAppNamesForWorkspaceAsync(userId, tenantId, 99);

        Assert.True(result.IsFailed);
    }

    [Fact]
    public async Task ListDatabricksAppNamesForWorkspaceAsync_FailsWhenWorkspaceUrlMissing()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IDatabricksApiService> databricksApi = new();
        Mock<IAppService> appService = new();

        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator = new();
        workspaceValidator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Fail<DatabricksConnection>(new BadRequestError("Workspace URL is missing.")));

        AppActionService sut = CreateSut(databricksApi, appService, workspaceValidator);

        Result<DatabricksAppNamesResponseDto> result =
            await sut.ListDatabricksAppNamesForWorkspaceAsync(userId, tenantId, 5);

        Assert.True(result.IsFailed);
    }
}
