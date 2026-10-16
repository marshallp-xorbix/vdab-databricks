using System.Text.Json;
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

public class AppActionServiceUpdateResourcesTests
{
    private static AppActionService CreateSut(
        Mock<IDatabricksApiService> databricksApi,
        Mock<IAppService> appService)
    {
        Mock<IDatabricksWorkspaceConnectionValidator> workspaceValidator = new();
        workspaceValidator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(It.IsAny<Guid>(), It.IsAny<int>()))
            .ReturnsAsync((Guid tenantId, int workspaceConnectionId) => Result.Ok(new DatabricksConnection
            {
                PkId = workspaceConnectionId,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test.cloud.databricks.com",
                WorkspaceDisplayName = "Test"
            }));
        Mock<IDatabricksAppProvisioningService> provisioning = new();
        return new AppActionService(
            databricksApi.Object,
            NullLogger<AppActionService>.Instance,
            appService.Object,
            workspaceValidator.Object,
            provisioning.Object);
    }

    private static JsonElement ParseElement(string json)
    {
        using JsonDocument doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    [Fact]
    public async Task UpdateAppResourcesAsync_ReturnsConflict_WhenUpdateTimeMismatch()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok(ParseElement("""{"name":"app","update_time":"remote-time"}""")));

        Mock<IAppService> appService = new();
        appService
            .Setup(x => x.GetAppByIdAsync(It.IsAny<int>(), tenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                Id = 1,
                AppName = "Local",
                DatabricksAppName = "my-dbx-app",
                WorkspaceConnectionId = 5,
                TenantId = tenantId,
                OwnerId = userId,
                WorkflowDefinition = "{}"
            }));
        AppActionService sut = CreateSut(databricksApi, appService);

        UpdateAppResourcesRequestDto request = new()
        {
            ExpectedUpdateTime = "client-time",
            Resources = new List<NormalizedAppResourceDto>
            {
                new NormalizedAppResourceDto
                {
                    Kind = DatabricksAppResourceKinds.Job,
                    Name = "r1",
                    Job = new JobResource { Id = "10", Permission = "CAN_VIEW" }
                }
            }
        };

        Result<UpdateAppResourcesResponseDto> result = await sut.UpdateAppResourcesAsync(userId, tenantId, 1, request);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
        databricksApi.Verify(
            x => x.PatchAsync<JsonElement>(
                It.IsAny<Guid>(),
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<JsonSerializerOptions>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateAppResourcesAsync_CallsPatch_WhenConcurrencyMatches()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        JsonElement getSnapshot = ParseElement(
            """
            {"name":"app","update_time":"same-time","resources":[]}
            """);

        JsonElement patchResponse = ParseElement(
            """
            {"name":"app","update_time":"after-patch","resources":[]}
            """);

        JsonElement refreshed = ParseElement(
            """
            {"name":"app","update_time":"after-patch","compute_size":"S","resources":[]}
            """);

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .SetupSequence(x => x.GetAsync<JsonElement>(
                    userId,
                    It.IsAny<int>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok(getSnapshot))
            .ReturnsAsync(Result.Ok(refreshed));

        databricksApi
            .Setup(x => x.PatchAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok(patchResponse));

        Mock<IAppService> appService = new();
        appService
            .Setup(x => x.GetAppByIdAsync(1, tenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                Id = 1,
                AppName = "Local",
                DatabricksAppName = "my-dbx-app",
                WorkspaceConnectionId = 5,
                TenantId = tenantId,
                OwnerId = userId,
                WorkflowDefinition = "{}"
            }));
        AppActionService sut = CreateSut(databricksApi, appService);

        UpdateAppResourcesRequestDto request = new()
        {
            ExpectedUpdateTime = "same-time",
            Resources = new List<NormalizedAppResourceDto>
            {
                new NormalizedAppResourceDto
                {
                    Kind = DatabricksAppResourceKinds.Job,
                    Name = "r1",
                    Job = new JobResource { Id = "10", Permission = "CAN_VIEW" }
                }
            }
        };

        Result<UpdateAppResourcesResponseDto> result = await sut.UpdateAppResourcesAsync(userId, tenantId, 1, request);

        Assert.True(result.IsSuccess);
        Assert.Equal("after-patch", result.Value.UpdateTime);
        databricksApi.Verify(
            x => x.PatchAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.Is<object>(body => PatchBodyIncludesResourcesOnly(body)),
                It.IsAny<JsonSerializerOptions>()),
            Times.Once);
    }

    [Fact]
    public async Task UpdateAppResourcesAsync_DoesNotPatchUserApiScopes()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        JsonElement getSnapshot = ParseElement(
            """
            {"name":"app","update_time":"same-time","resources":[],"user_api_scopes":["iam.current-user:read"]}
            """);

        JsonElement patchResponse = ParseElement(
            """
            {"name":"app","update_time":"after-patch","resources":[]}
            """);

        object? patchedBody = null;
        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .SetupSequence(x => x.GetAsync<JsonElement>(
                    userId,
                    It.IsAny<int>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok(getSnapshot))
            .ReturnsAsync(Result.Ok(patchResponse));

        databricksApi
            .Setup(x => x.PatchAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<JsonSerializerOptions>()))
            .Callback<Guid, int, string, string, object, JsonSerializerOptions?>(
                (_, _, _, _, body, _) => patchedBody = body)
            .ReturnsAsync(Result.Ok(patchResponse));

        Mock<IAppService> appService = new();
        appService
            .Setup(x => x.GetAppByIdAsync(1, tenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                Id = 1,
                AppName = "Local",
                DatabricksAppName = "my-dbx-app",
                WorkspaceConnectionId = 5,
                TenantId = tenantId,
                OwnerId = userId,
                WorkflowDefinition = "{}"
            }));
        AppActionService sut = CreateSut(databricksApi, appService);

        UpdateAppResourcesRequestDto request = new()
        {
            ExpectedUpdateTime = "same-time",
            Resources = new List<NormalizedAppResourceDto>()
        };

        Result<UpdateAppResourcesResponseDto> result = await sut.UpdateAppResourcesAsync(userId, tenantId, 1, request);

        Assert.True(result.IsSuccess);
        string json = JsonSerializer.Serialize(patchedBody);
        Assert.DoesNotContain("user_api_scopes", json, StringComparison.Ordinal);
        Assert.Contains("resources", json, StringComparison.Ordinal);
    }

    private static bool PatchBodyIncludesResourcesOnly(object body)
    {
        string json = JsonSerializer.Serialize(body);
        return json.Contains("resources", StringComparison.Ordinal)
            && !json.Contains("user_api_scopes", StringComparison.Ordinal);
    }

    [Fact]
    public async Task UpdateAppResourcesAsync_ReturnsBadRequest_WithParsedDatabricksMessage_WhenPatchFails()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        JsonElement getSnapshot = ParseElement(
            """
            {"name":"app","update_time":"t1","resources":[]}
            """);

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok(getSnapshot));

        databricksApi
            .Setup(x => x.PatchAsync<JsonElement>(
                userId,
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<JsonSerializerOptions>()))
            .ReturnsAsync(Result.Fail<JsonElement>(new BadRequestError(
                """
                Databricks API returned Forbidden. Details: {"error_code":"PERMISSION_DENIED","message":"Cannot grant SQL warehouse permission."}
                """)));

        Mock<IAppService> appService = new();
        appService
            .Setup(x => x.GetAppByIdAsync(1, tenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                Id = 1,
                AppName = "Local",
                DatabricksAppName = "my-dbx-app",
                WorkspaceConnectionId = 5,
                TenantId = tenantId,
                OwnerId = userId,
                WorkflowDefinition = "{}"
            }));
        AppActionService sut = CreateSut(databricksApi, appService);

        UpdateAppResourcesRequestDto request = new()
        {
            ExpectedUpdateTime = "t1",
            Resources = new List<NormalizedAppResourceDto>
            {
                new NormalizedAppResourceDto
                {
                    Kind = DatabricksAppResourceKinds.SqlWarehouse,
                    Name = "wh",
                    SqlWarehouse = new SqlWarehouseResource
                    {
                        Id = "abc",
                        Permission = "CAN_MANAGE"
                    }
                }
            }
        };

        Result<UpdateAppResourcesResponseDto> result = await sut.UpdateAppResourcesAsync(userId, tenantId, 1, request);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
        Assert.Contains(
            "Cannot grant SQL warehouse permission",
            result.Errors[0].Message,
            StringComparison.Ordinal);
        Assert.Contains("PERMISSION_DENIED", result.Errors[0].Message, StringComparison.Ordinal);
    }
}
