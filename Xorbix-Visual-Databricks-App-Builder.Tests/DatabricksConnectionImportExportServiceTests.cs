using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class DatabricksConnectionImportExportServiceTests
{
    private static DatabricksConnectionImportExportService CreateSut(
        Mock<IDatabricksConnectionRepository> repository,
        Mock<IDatabricksConnectionService> connectionService,
        Mock<IUserTenantMembershipService> membershipService)
    {
        return new DatabricksConnectionImportExportService(
            repository.Object,
            connectionService.Object,
            membershipService.Object,
            NullLogger<DatabricksConnectionImportExportService>.Instance);
    }

    private static ImportConnectionRequest BuildRequest(string url, string displayName, Guid ownerId)
    {
        return new ImportConnectionRequest
        {
            Connection = new DatabricksConnectionExportDto
            {
                WorkspaceUrl = url,
                WorkspaceDisplayName = displayName,
                ClientId = "client-id"
            },
            OwnerId = ownerId
        };
    }

    [Fact]
    public async Task ImportConnectionAsync_CreatesConnection_WhenRequestValid()
    {
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.GetByTenantIdAsync(tenantId))
            .ReturnsAsync([]);

        Mock<IDatabricksConnectionService> connectionService = new();
        connectionService
            .Setup(x => x.CreateConnectionAsync(
                It.IsAny<CreateDatabricksConnectionRequest>(), ownerId, tenantId))
            .ReturnsAsync(Result.Ok(new DatabricksConnectionDto
            {
                PkId = 31,
                TenantId = tenantId,
                OwnerId = ownerId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Workspace"
            }));

        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(x => x.UserBelongsToTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        DatabricksConnectionImportExportService sut = CreateSut(
            repository, connectionService, membershipService);

        Result<ImportElementResultDto> result = await sut.ImportConnectionAsync(
            BuildRequest("https://dbc.test", "Workspace", ownerId), tenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(31, result.Value.NewId);
        Assert.False(result.Value.Renamed);
    }

    [Fact]
    public async Task ImportConnectionAsync_PropagatesConflict_WhenWorkspaceUrlExists()
    {
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.GetByTenantIdAsync(tenantId))
            .ReturnsAsync([]);

        Mock<IDatabricksConnectionService> connectionService = new();
        connectionService
            .Setup(x => x.CreateConnectionAsync(
                It.IsAny<CreateDatabricksConnectionRequest>(), ownerId, tenantId))
            .ReturnsAsync(Result.Fail<DatabricksConnectionDto>(
                new ConflictError("A workspace connection with this URL already exists for your tenant.")));

        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(x => x.UserBelongsToTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        DatabricksConnectionImportExportService sut = CreateSut(
            repository, connectionService, membershipService);

        Result<ImportElementResultDto> result = await sut.ImportConnectionAsync(
            BuildRequest("https://dbc.test", "Workspace", ownerId), tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
    }

    [Fact]
    public async Task ImportConnectionAsync_ReturnsBadRequest_WhenOwnerNotInTenant()
    {
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        Mock<IDatabricksConnectionRepository> repository = new();
        Mock<IDatabricksConnectionService> connectionService = new();
        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(x => x.UserBelongsToTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        DatabricksConnectionImportExportService sut = CreateSut(
            repository, connectionService, membershipService);

        Result<ImportElementResultDto> result = await sut.ImportConnectionAsync(
            BuildRequest("https://dbc.test", "Workspace", ownerId), tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
        connectionService.Verify(
            x => x.CreateConnectionAsync(
                It.IsAny<CreateDatabricksConnectionRequest>(), It.IsAny<Guid>(), It.IsAny<Guid>()),
            Times.Never);
    }

    [Fact]
    public async Task ExportConnectionsByTenantAsync_ExcludesClientSecret()
    {
        Guid tenantId = Guid.NewGuid();

        Mock<IDatabricksConnectionRepository> repository = new();
        repository
            .Setup(x => x.GetByTenantIdAsync(tenantId))
            .ReturnsAsync(
            [
                new DatabricksConnection
                {
                    PkId = 1,
                    TenantId = tenantId,
                    WorkspaceUrl = "https://dbc.test",
                    WorkspaceDisplayName = "Workspace",
                    ClientId = "client-id",
                    ClientSecret = "super-secret"
                }
            ]);

        Mock<IDatabricksConnectionService> connectionService = new();
        Mock<IUserTenantMembershipService> membershipService = new();

        DatabricksConnectionImportExportService sut = CreateSut(
            repository, connectionService, membershipService);

        Result<ExportBundleDto> result = await sut.ExportConnectionsByTenantAsync(tenantId);

        Assert.True(result.IsSuccess);
        DatabricksConnectionExportDto exported = Assert.Single(result.Value.Connections!);
        Assert.Equal("client-id", exported.ClientId);
        Assert.Equal("https://dbc.test", exported.WorkspaceUrl);
        // The export DTO has no client-secret field; serialized output cannot leak it.
        Assert.DoesNotContain(
            "super-secret",
            System.Text.Json.JsonSerializer.Serialize(exported));
    }
}
