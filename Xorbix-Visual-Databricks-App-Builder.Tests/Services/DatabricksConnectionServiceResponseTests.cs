using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

public class DatabricksConnectionServiceResponseTests
{
    private const string StoredClientSecret = "super-secret";

    [Fact]
    public async Task GetConnectionsByTenantIdAsync_EntityHasClientSecret_ReturnsResponseWithoutClientSecret()
    {
        Guid tenantId = Guid.NewGuid();
        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.GetByTenantIdAsync(tenantId))
            .ReturnsAsync(
            [
                BuildConnection(tenantId)
            ]);

        DatabricksConnectionService sut = CreateSut(repository);

        Result<IEnumerable<DatabricksConnectionDto>> result = await sut.GetConnectionsByTenantIdAsync(tenantId);

        Assert.True(result.IsSuccess);
        DatabricksConnectionDto connection = Assert.Single(result.Value);
        Assert.Equal("client-id", connection.ClientId);
        AssertSerializedResponseDoesNotContainClientSecret(connection);
    }

    [Fact]
    public async Task CreateConnectionAsync_RequestHasClientSecret_ReturnsResponseWithoutClientSecret()
    {
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();
        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.ExistsByTenantAndWorkspaceUrlAsync(
                tenantId,
                "https://dbc.test",
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repository
            .Setup(x => x.AddAsync(It.IsAny<DatabricksConnection>()))
            .Callback<DatabricksConnection>(connection => connection.PkId = 17)
            .Returns(Task.CompletedTask);

        Mock<ITenantLimitService> tenantLimitService = new();
        tenantLimitService
            .Setup(x => x.EnsureCanAddWorkspaceConnectionAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        DatabricksConnectionService sut = CreateSut(repository, tenantLimitService);
        CreateDatabricksConnectionRequest request = new()
        {
            WorkspaceUrl = "https://dbc.test",
            WorkspaceDisplayName = "Workspace",
            ClientId = "client-id",
            ClientSecret = StoredClientSecret
        };

        Result<DatabricksConnectionDto> result = await sut.CreateConnectionAsync(request, ownerId, tenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(17, result.Value.PkId);
        AssertSerializedResponseDoesNotContainClientSecret(result.Value);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateConnectionAsync_BlankClientId_PreservesExisting(string? clientId)
    {
        Guid tenantId = Guid.NewGuid();
        DatabricksConnection stored = BuildConnection(tenantId);
        DatabricksConnection? updated = null;
        Mock<IDatabricksConnectionRepository> repository = CreateUpdateRepositoryMock(tenantId, stored, connection => updated = connection);
        DatabricksConnectionService sut = CreateSut(repository);

        UpdateDatabricksConnectionRequest request = BuildUpdateRequest(clientId: clientId);

        Result<DatabricksConnectionDto> result = await sut.UpdateConnectionAsync(stored.PkId, request, tenantId);

        Assert.True(result.IsSuccess);
        Assert.NotNull(updated);
        Assert.Equal("client-id", updated.ClientId);
        Assert.Equal(StoredClientSecret, updated.ClientSecret);
    }

    [Fact]
    public async Task UpdateConnectionAsync_NewClientId_UpdatesValue()
    {
        Guid tenantId = Guid.NewGuid();
        DatabricksConnection stored = BuildConnection(tenantId);
        DatabricksConnection? updated = null;
        Mock<IDatabricksConnectionRepository> repository = CreateUpdateRepositoryMock(tenantId, stored, connection => updated = connection);
        DatabricksConnectionService sut = CreateSut(repository);

        UpdateDatabricksConnectionRequest request = BuildUpdateRequest(clientId: "new-id");

        Result<DatabricksConnectionDto> result = await sut.UpdateConnectionAsync(stored.PkId, request, tenantId);

        Assert.True(result.IsSuccess);
        Assert.NotNull(updated);
        Assert.Equal("new-id", updated.ClientId);
        Assert.Equal(StoredClientSecret, updated.ClientSecret);
    }

    [Fact]
    public async Task UpdateConnectionAsync_EmptyClientSecret_PreservesExisting()
    {
        Guid tenantId = Guid.NewGuid();
        DatabricksConnection stored = BuildConnection(tenantId);
        DatabricksConnection? updated = null;
        Mock<IDatabricksConnectionRepository> repository = CreateUpdateRepositoryMock(tenantId, stored, connection => updated = connection);
        DatabricksConnectionService sut = CreateSut(repository);

        UpdateDatabricksConnectionRequest request = BuildUpdateRequest(clientSecret: "");

        Result<DatabricksConnectionDto> result = await sut.UpdateConnectionAsync(stored.PkId, request, tenantId);

        Assert.True(result.IsSuccess);
        Assert.NotNull(updated);
        Assert.Equal("client-id", updated.ClientId);
        Assert.Equal(StoredClientSecret, updated.ClientSecret);
    }

    private static Mock<IDatabricksConnectionRepository> CreateUpdateRepositoryMock(
        Guid tenantId,
        DatabricksConnection stored,
        Action<DatabricksConnection> onUpdate)
    {
        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.GetByIdAsync(stored.PkId))
            .ReturnsAsync(stored);
        repository
            .Setup(x => x.GetByIdForTenantAsync(stored.PkId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stored);
        repository
            .Setup(x => x.ExistsByTenantAndWorkspaceUrlAsync(
                tenantId,
                stored.WorkspaceUrl,
                stored.PkId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repository
            .Setup(x => x.UpdateAsync(It.IsAny<DatabricksConnection>()))
            .Callback<DatabricksConnection>(connection => onUpdate(connection))
            .Returns(Task.CompletedTask);
        return repository;
    }

    private static UpdateDatabricksConnectionRequest BuildUpdateRequest(
        string? clientId = "client-id",
        string? clientSecret = null)
    {
        return new UpdateDatabricksConnectionRequest
        {
            WorkspaceUrl = "https://dbc.test",
            WorkspaceDisplayName = "Workspace",
            ClientId = clientId,
            ClientSecret = clientSecret
        };
    }

    private static DatabricksConnectionService CreateSut(
        Mock<IDatabricksConnectionRepository> repository,
        Mock<ITenantLimitService>? tenantLimitService = null,
        Mock<ITenantResourceGuard>? tenantResourceGuard = null)
    {
        return new DatabricksConnectionService(
            repository.Object,
            Mock.Of<IDatabricksUserTokenRepository>(),
            Mock.Of<IDatabricksAccessTokenCache>(),
            Mock.Of<IHttpClientFactory>(),
            NullLogger<DatabricksConnectionService>.Instance,
            tenantLimitService?.Object ?? Mock.Of<ITenantLimitService>(),
            tenantResourceGuard?.Object ?? Mock.Of<ITenantResourceGuard>(),
            Mock.Of<IDatabricksWorkspaceConnectionValidator>());
    }

    private static DatabricksConnection BuildConnection(Guid tenantId)
    {
        return new DatabricksConnection
        {
            PkId = 11,
            TenantId = tenantId,
            OwnerId = Guid.NewGuid(),
            WorkspaceUrl = "https://dbc.test",
            WorkspaceDisplayName = "Workspace",
            ClientId = "client-id",
            ClientSecret = StoredClientSecret
        };
    }

    private static void AssertSerializedResponseDoesNotContainClientSecret(DatabricksConnectionDto connection)
    {
        string serialized = JsonSerializer.Serialize(connection);

        Assert.DoesNotContain("ClientSecret", serialized);
        Assert.DoesNotContain("clientSecret", serialized);
        Assert.DoesNotContain(StoredClientSecret, serialized);
    }
}
