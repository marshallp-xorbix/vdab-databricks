using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class DatabricksApiServiceTests
{
    [Fact]
    public async Task GetAsync_ReturnsFailure_WhenWorkspaceUrlDoesNotMatchConnection()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        int workspaceConnectionId = 42;

        Mock<IHttpClientFactory> httpClientFactory = new();
        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        Mock<IDatabricksConnectionService> connectionService = new();
        Mock<ICurrentUserService> currentUserService = new();

        currentUserService.Setup(service => service.GetUserId()).Returns(userId);
        currentUserService.Setup(service => service.GetTenantId()).Returns(tenantId);

        connectionRepository
            .Setup(repository => repository.GetByIdAsync(workspaceConnectionId))
            .ReturnsAsync(new DatabricksConnection
            {
                PkId = workspaceConnectionId,
                TenantId = tenantId,
                OwnerId = userId,
                WorkspaceUrl = "https://expected-workspace.azuredatabricks.net",
                WorkspaceDisplayName = "Expected Workspace"
            });

        DatabricksApiService sut = new(
            httpClientFactory.Object,
            connectionRepository.Object,
            connectionService.Object,
            currentUserService.Object,
            NullLogger<DatabricksApiService>.Instance);

        Result<JsonElement> result = await sut.GetAsync<JsonElement>(
            userId,
            workspaceConnectionId,
            "https://different-workspace.azuredatabricks.net",
            "/api/2.0/apps");

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, error => error.Message.Contains("Workspace URL does not match", StringComparison.OrdinalIgnoreCase));

        connectionService.Verify(
            service => service.GetValidAccessTokenAsync(It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<Guid>()),
            Times.Never);
        httpClientFactory.Verify(factory => factory.CreateClient(It.IsAny<string>()), Times.Never);
    }
}
