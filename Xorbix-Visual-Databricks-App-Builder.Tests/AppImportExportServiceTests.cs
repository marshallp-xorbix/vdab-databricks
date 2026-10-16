using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class AppImportExportServiceTests
{
    private static AppImportExportService CreateSut(
        Mock<IAppRepository> appRepository,
        Mock<IAppComponentRepository> componentRepository,
        Mock<IDatabricksConnectionRepository> connectionRepository,
        Mock<IUserTenantMembershipService> membershipService)
    {
        return new AppImportExportService(
            appRepository.Object,
            componentRepository.Object,
            connectionRepository.Object,
            membershipService.Object,
            NullLogger<AppImportExportService>.Instance);
    }

    private static ImportAppRequest BuildRequest(string appName, int connectionId, Guid ownerId)
    {
        return new ImportAppRequest
        {
            App = new AppExportDto
            {
                AppName = appName,
                WorkflowDefinition = "{\"version\":1,\"workflows\":[]}",
                Components =
                [
                    new AppComponentExportDto
                    {
                        ComponentType = ComponentType.Button,
                        ComponentVersion = 1,
                        Properties = "{}"
                    }
                ]
            },
            WorkspaceConnectionId = connectionId,
            OwnerId = ownerId
        };
    }

    [Fact]
    public async Task ImportAppAsync_CreatesAppAndComponents_WhenRequestValid()
    {
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        Mock<IAppRepository> appRepository = new();
        App? capturedApp = null;
        appRepository
            .Setup(x => x.AddAsync(It.IsAny<App>()))
            .Callback<App>(app => { capturedApp = app; app.PkId = 77; })
            .Returns(Task.CompletedTask);
        appRepository
            .Setup(x => x.GetByTenantIdAsync(tenantId))
            .ReturnsAsync([]);

        Mock<IAppComponentRepository> componentRepository = new();
        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        connectionRepository
            .Setup(x => x.GetByIdAsync(5))
            .ReturnsAsync(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Workspace"
            });

        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(x => x.UserBelongsToTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        AppImportExportService sut = CreateSut(
            appRepository, componentRepository, connectionRepository, membershipService);

        Result<ImportElementResultDto> result = await sut.ImportAppAsync(
            BuildRequest("My App", 5, ownerId), tenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(77, result.Value.NewId);
        Assert.False(result.Value.Renamed);
        Assert.Equal(ownerId, capturedApp!.OwnerId);
        Assert.Equal(tenantId, capturedApp.TenantId);
        Assert.Equal(5, capturedApp.WorkspaceConnectionId);
        componentRepository.Verify(x => x.AddAsync(It.IsAny<AppComponent>()), Times.Once);
    }

    [Fact]
    public async Task ImportAppAsync_RenamesApp_WhenNameCollides()
    {
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        Mock<IAppRepository> appRepository = new();
        appRepository
            .Setup(x => x.AddAsync(It.IsAny<App>()))
            .Returns(Task.CompletedTask);
        appRepository
            .Setup(x => x.GetByTenantIdAsync(tenantId))
            .ReturnsAsync(
            [
                new App { PkId = 1, AppName = "My App", WorkspaceConnectionId = 5 }
            ]);

        Mock<IAppComponentRepository> componentRepository = new();
        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        connectionRepository
            .Setup(x => x.GetByIdAsync(5))
            .ReturnsAsync(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Workspace"
            });

        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(x => x.UserBelongsToTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        AppImportExportService sut = CreateSut(
            appRepository, componentRepository, connectionRepository, membershipService);

        Result<ImportElementResultDto> result = await sut.ImportAppAsync(
            BuildRequest("My App", 5, ownerId), tenantId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Renamed);
        Assert.Equal("My App (imported)", result.Value.Name);
    }

    [Fact]
    public async Task ImportAppAsync_ReturnsForbidden_WhenConnectionBelongsToAnotherTenant()
    {
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        Mock<IAppRepository> appRepository = new();
        Mock<IAppComponentRepository> componentRepository = new();
        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        connectionRepository
            .Setup(x => x.GetByIdAsync(5))
            .ReturnsAsync(new DatabricksConnection
            {
                PkId = 5,
                TenantId = Guid.NewGuid(),
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Workspace"
            });

        Mock<IUserTenantMembershipService> membershipService = new();

        AppImportExportService sut = CreateSut(
            appRepository, componentRepository, connectionRepository, membershipService);

        Result<ImportElementResultDto> result = await sut.ImportAppAsync(
            BuildRequest("My App", 5, ownerId), tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
        appRepository.Verify(x => x.AddAsync(It.IsAny<App>()), Times.Never);
    }

    [Fact]
    public async Task ImportAppAsync_ReturnsBadRequest_WhenOwnerNotInTenant()
    {
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        Mock<IAppRepository> appRepository = new();
        Mock<IAppComponentRepository> componentRepository = new();
        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        connectionRepository
            .Setup(x => x.GetByIdAsync(5))
            .ReturnsAsync(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Workspace"
            });

        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(x => x.UserBelongsToTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        AppImportExportService sut = CreateSut(
            appRepository, componentRepository, connectionRepository, membershipService);

        Result<ImportElementResultDto> result = await sut.ImportAppAsync(
            BuildRequest("My App", 5, ownerId), tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
        appRepository.Verify(x => x.AddAsync(It.IsAny<App>()), Times.Never);
    }

    [Fact]
    public async Task ExportAppAsync_ReturnsForbidden_WhenAppBelongsToAnotherTenant()
    {
        Guid tenantId = Guid.NewGuid();

        Mock<IAppRepository> appRepository = new();
        appRepository
            .Setup(x => x.GetByIdAsync(9))
            .ReturnsAsync(new App
            {
                PkId = 9,
                AppName = "Other",
                TenantId = Guid.NewGuid(),
                WorkspaceConnectionId = 1
            });

        Mock<IAppComponentRepository> componentRepository = new();
        Mock<IDatabricksConnectionRepository> connectionRepository = new();
        Mock<IUserTenantMembershipService> membershipService = new();

        AppImportExportService sut = CreateSut(
            appRepository, componentRepository, connectionRepository, membershipService);

        Result<ExportBundleDto> result = await sut.ExportAppAsync(9, tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }
}
