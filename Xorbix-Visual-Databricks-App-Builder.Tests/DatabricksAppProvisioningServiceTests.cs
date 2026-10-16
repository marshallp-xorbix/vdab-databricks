using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class DatabricksAppProvisioningServiceTests
{
    [Fact]
    public async Task CreateDatabricksAppAsync_DoesNotSetUserApiScopes()
    {
        Guid userId = Guid.NewGuid();
        object? postedBody = null;
        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.PostAsync<DatabricksAppResponse>(
                userId,
                7,
                "https://dbc.test.cloud.databricks.com",
                DatabricksApiRoutes.AppsCreatePath,
                It.IsAny<object>(),
                It.IsAny<JsonSerializerOptions>()))
            .Callback<Guid, int, string, string, object, JsonSerializerOptions?>(
                (_, _, _, _, body, _) => postedBody = body)
            .ReturnsAsync(Result.Ok(new DatabricksAppResponse
            {
                Name = "my-app",
                UpdateTime = "t1",
                Url = "https://example.cloud.databricksapps.com"
            }));

        DatabricksAppProvisioningService sut = new(
            databricksApi.Object,
            NullLogger<DatabricksAppProvisioningService>.Instance);

        Result<CreatedDatabricksAppDto> result = await sut.CreateDatabricksAppAsync(
            userId,
            "https://dbc.test.cloud.databricks.com",
            7,
            "my-app",
            "desc",
            resources: null,
            "upstream failed");

        Assert.True(result.IsSuccess);
        CreateDatabricksAppApiRequest? request = Assert.IsType<CreateDatabricksAppApiRequest>(postedBody);
        Assert.Equal("my-app", request.Name);
        string json = JsonSerializer.Serialize(postedBody);
        Assert.DoesNotContain("user_api_scopes", json, StringComparison.Ordinal);
    }
}
