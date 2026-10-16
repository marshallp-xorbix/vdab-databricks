using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

public class DatabricksConnectionServiceUpdateTests
{
    private const int ConnectionId = 42;

    [Fact]
    public async Task UpdateConnectionAsync_WhenConnectionNotInTenant_ReturnsNotFound()
    {
        Guid tenantId = Guid.NewGuid();
        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.GetByIdForTenantAsync(ConnectionId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((DatabricksConnection?)null);

        DatabricksConnectionService sut = CreateSut(repository);
        UpdateDatabricksConnectionRequest request = BuildUpdateRequest();

        Result<DatabricksConnectionDto> result = await sut.UpdateConnectionAsync(ConnectionId, request, tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
        Assert.False(result.HasError<BadRequestError>());
        repository.Verify(
            x => x.UpdateAsync(It.IsAny<DatabricksConnection>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateConnectionAsync_WhenConnectionNotFound_ReturnsNotFound()
    {
        Guid tenantId = Guid.NewGuid();
        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.GetByIdForTenantAsync(ConnectionId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((DatabricksConnection?)null);

        DatabricksConnectionService sut = CreateSut(repository);
        UpdateDatabricksConnectionRequest request = BuildUpdateRequest();

        Result<DatabricksConnectionDto> result = await sut.UpdateConnectionAsync(ConnectionId, request, tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
    }

    [Fact]
    public async Task UpdateConnectionAsync_WhenConnectionInTenant_Succeeds()
    {
        Guid tenantId = Guid.NewGuid();
        DatabricksConnection existing = BuildConnection(tenantId);
        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.GetByIdForTenantAsync(ConnectionId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);
        repository
            .Setup(x => x.ExistsByTenantAndWorkspaceUrlAsync(
                tenantId,
                "https://dbc.test",
                ConnectionId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repository
            .Setup(x => x.UpdateAsync(It.IsAny<DatabricksConnection>()))
            .Returns(Task.CompletedTask);

        DatabricksConnectionService sut = CreateSut(repository);
        UpdateDatabricksConnectionRequest request = BuildUpdateRequest();

        Result<DatabricksConnectionDto> result = await sut.UpdateConnectionAsync(ConnectionId, request, tenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(ConnectionId, result.Value.PkId);
        repository.Verify(x => x.UpdateAsync(existing), Times.Once);
    }

    private static DatabricksConnectionService CreateSut(Mock<IDatabricksConnectionRepository> repository)
    {
        return new DatabricksConnectionService(
            repository.Object,
            Mock.Of<IDatabricksUserTokenRepository>(),
            Mock.Of<IDatabricksAccessTokenCache>(),
            Mock.Of<IHttpClientFactory>(),
            NullLogger<DatabricksConnectionService>.Instance,
            Mock.Of<ITenantLimitService>(),
            Mock.Of<ITenantResourceGuard>(),
            Mock.Of<IDatabricksWorkspaceConnectionValidator>());
    }

    private static UpdateDatabricksConnectionRequest BuildUpdateRequest()
    {
        return new UpdateDatabricksConnectionRequest
        {
            WorkspaceUrl = "https://dbc.test",
            WorkspaceDisplayName = "Updated Workspace",
            ClientId = "client-id",
        };
    }

    private static DatabricksConnection BuildConnection(Guid tenantId)
    {
        return new DatabricksConnection
        {
            PkId = ConnectionId,
            TenantId = tenantId,
            OwnerId = Guid.NewGuid(),
            WorkspaceUrl = "https://dbc.test",
            WorkspaceDisplayName = "Workspace",
            ClientId = "client-id",
        };
    }
}
