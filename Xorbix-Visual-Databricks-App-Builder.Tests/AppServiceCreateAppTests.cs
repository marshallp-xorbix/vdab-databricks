using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class AppServiceCreateAppTests
{
    private static Mock<ITenantLimitService> CreatePermissiveLimitService()
    {
        Mock<ITenantLimitService> limitService = new();
        limitService
            .Setup(service => service.EnsureCanCreateAppAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        return limitService;
    }

    private static Mock<ITenantResourceGuard> CreatePermissiveTenantGuard()
    {
        Mock<ITenantResourceGuard> tenantResourceGuard = new();
        tenantResourceGuard
            .Setup(guard => guard.EnsureAppInTenant(It.IsAny<AppDto?>(), It.IsAny<Guid>()))
            .Returns(Result.Ok());
        tenantResourceGuard
            .Setup(guard => guard.EnsureAppInTenant(It.IsAny<App?>(), It.IsAny<Guid>()))
            .Returns(Result.Ok());
        tenantResourceGuard
            .Setup(guard => guard.EnsureConnectionInTenant(It.IsAny<DatabricksConnection?>(), It.IsAny<Guid>()))
            .Returns(Result.Ok());
        return tenantResourceGuard;
    }

    [Fact]
    public async Task CreateAppAsync_ReturnsForbiddenAndDoesNotValidateConnection_WhenAppLimitReached()
    {
        Guid ownerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IAppRepository> repository = new();
        Mock<IDatabricksApiService> databricksApi = new();
        Mock<IDatabricksWorkspaceConnectionValidator> validator = new();
        Mock<IDatabricksAppProvisioningService> provisioning = new();

        Mock<ITenantLimitService> limitService = new();
        limitService
            .Setup(service => service.EnsureCanCreateAppAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new ForbiddenError("Your plan allows up to 10 app(s).")));

        AppService sut = new AppService(
            repository.Object,
            NullLogger<AppService>.Instance,
            databricksApi.Object,
            validator.Object,
            provisioning.Object,
            limitService.Object,
            CreatePermissiveTenantGuard().Object);

        CreateAppRequest request = new CreateAppRequest
        {
            AppName = "VDAB App",
            WorkspaceConnectionId = 5,
            DatabricksAppMode = DatabricksAppCreationMode.LinkExisting,
            DatabricksAppName = "existing-app"
        };

        Result<AppDto> result = await sut.CreateAppAsync(request, ownerId, tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
        validator.Verify(
            x => x.ValidateWorkspaceConnectionForTenantAsync(It.IsAny<Guid>(), It.IsAny<int>()),
            Times.Never);
        repository.Verify(x => x.AddAsync(It.IsAny<App>()), Times.Never);
    }

    [Fact]
    public async Task CreateAppAsync_LinkExisting_PersistsWithVerifiedDatabricksName()
    {
        Guid ownerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IAppRepository> repository = new();
        App? capturedApp = null;
        repository
            .Setup(x => x.AddAsync(It.IsAny<App>()))
            .Callback<App>(app =>
            {
                capturedApp = app;
                app.PkId = 42;
            })
            .Returns(Task.CompletedTask);

        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetDatabricksAppByNameAsync(
                ownerId,
                5,
                "https://dbc.test",
                "existing-app",
                It.IsAny<System.Text.Json.JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok<DatabricksAppResponse?>(new DatabricksAppResponse
            {
                Name = "existing-app-canonical"
            }));

        Mock<IDatabricksWorkspaceConnectionValidator> validator = new();
        validator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Ok(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Test Workspace"
            }));

        Mock<IDatabricksAppProvisioningService> provisioning = new();

        AppService sut = new AppService(
            repository.Object,
            NullLogger<AppService>.Instance,
            databricksApi.Object,
            validator.Object,
            provisioning.Object,
            CreatePermissiveLimitService().Object,
            CreatePermissiveTenantGuard().Object);

        CreateAppRequest request = new CreateAppRequest
        {
            AppName = "VDAB App",
            WorkspaceConnectionId = 5,
            DatabricksAppMode = DatabricksAppCreationMode.LinkExisting,
            DatabricksAppName = "existing-app"
        };

        Result<AppDto> result = await sut.CreateAppAsync(request, ownerId, tenantId);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedApp);
        Assert.Equal(CustomModulesTemplate.ResolveContent(null), capturedApp!.CustomModulesCode);
        Assert.Equal("existing-app-canonical", capturedApp!.DatabricksAppName);
        Assert.Equal(42, result.Value.Id);
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
    public async Task CreateAppAsync_LinkExisting_ReturnsBadRequestWhenDatabricksAppMissing()
    {
        Guid ownerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IAppRepository> repository = new();
        Mock<IDatabricksApiService> databricksApi = new();
        databricksApi
            .Setup(x => x.GetDatabricksAppByNameAsync(
                ownerId,
                5,
                "https://dbc.test",
                "missing-app",
                It.IsAny<System.Text.Json.JsonSerializerOptions>()))
            .ReturnsAsync(Result.Ok<DatabricksAppResponse?>(null));

        Mock<IDatabricksWorkspaceConnectionValidator> validator = new();
        validator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Ok(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Test Workspace"
            }));

        Mock<IDatabricksAppProvisioningService> provisioning = new();

        AppService sut = new AppService(
            repository.Object,
            NullLogger<AppService>.Instance,
            databricksApi.Object,
            validator.Object,
            provisioning.Object,
            CreatePermissiveLimitService().Object,
            CreatePermissiveTenantGuard().Object);

        CreateAppRequest request = new CreateAppRequest
        {
            AppName = "VDAB App",
            WorkspaceConnectionId = 5,
            DatabricksAppMode = DatabricksAppCreationMode.LinkExisting,
            DatabricksAppName = "missing-app"
        };

        Result<AppDto> result = await sut.CreateAppAsync(request, ownerId, tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
        repository.Verify(x => x.AddAsync(It.IsAny<App>()), Times.Never);
    }

    [Fact]
    public async Task CreateAppAsync_CreateNew_PersistsUsingCreatedDatabricksName()
    {
        Guid ownerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IAppRepository> repository = new();
        App? capturedApp = null;
        repository
            .Setup(x => x.AddAsync(It.IsAny<App>()))
            .Callback<App>(app =>
            {
                capturedApp = app;
                app.PkId = 7;
            })
            .Returns(Task.CompletedTask);

        Mock<IDatabricksApiService> databricksApi = new();

        Mock<IDatabricksWorkspaceConnectionValidator> validator = new();
        validator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Ok(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Test Workspace"
            }));

        Mock<IDatabricksAppProvisioningService> provisioning = new();
        provisioning
            .Setup(x => x.CreateDatabricksAppAsync(
                ownerId,
                "https://dbc.test",
                5,
                "new-dbx-app",
                "Databricks description",
                null,
                It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(new CreatedDatabricksAppDto
            {
                Name = "new-dbx-app-canonical",
                UpdateTime = "2026-01-01T00:00:00Z"
            }));

        AppService sut = new AppService(
            repository.Object,
            NullLogger<AppService>.Instance,
            databricksApi.Object,
            validator.Object,
            provisioning.Object,
            CreatePermissiveLimitService().Object,
            CreatePermissiveTenantGuard().Object);

        CreateAppRequest request = new CreateAppRequest
        {
            AppName = "VDAB App",
            WorkspaceConnectionId = 5,
            DatabricksAppMode = DatabricksAppCreationMode.CreateNew,
            DatabricksAppName = "new-dbx-app",
            DatabricksAppDescription = "Databricks description"
        };

        Result<AppDto> result = await sut.CreateAppAsync(request, ownerId, tenantId);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedApp);
        Assert.Equal("new-dbx-app-canonical", capturedApp!.DatabricksAppName);
        repository.Verify(x => x.AddAsync(It.IsAny<App>()), Times.Once);
    }

    [Fact]
    public async Task CreateAppAsync_CreateNew_ReturnsUpstreamErrorWhenDatabricksCreateFails()
    {
        Guid ownerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IAppRepository> repository = new();
        Mock<IDatabricksApiService> databricksApi = new();

        Mock<IDatabricksWorkspaceConnectionValidator> validator = new();
        validator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Ok(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Test Workspace"
            }));

        Mock<IDatabricksAppProvisioningService> provisioning = new();
        provisioning
            .Setup(x => x.CreateDatabricksAppAsync(
                ownerId,
                "https://dbc.test",
                5,
                "new-dbx-app",
                null,
                null,
                It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<CreatedDatabricksAppDto>(new UpstreamDependencyError("Failed upstream")));

        AppService sut = new AppService(
            repository.Object,
            NullLogger<AppService>.Instance,
            databricksApi.Object,
            validator.Object,
            provisioning.Object,
            CreatePermissiveLimitService().Object,
            CreatePermissiveTenantGuard().Object);

        CreateAppRequest request = new CreateAppRequest
        {
            AppName = "VDAB App",
            WorkspaceConnectionId = 5,
            DatabricksAppMode = DatabricksAppCreationMode.CreateNew,
            DatabricksAppName = "new-dbx-app"
        };

        Result<AppDto> result = await sut.CreateAppAsync(request, ownerId, tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<UpstreamDependencyError>());
        repository.Verify(x => x.AddAsync(It.IsAny<App>()), Times.Never);
    }

    [Fact]
    public async Task CreateAppAsync_ReturnsBadRequestWhenWorkspaceConnectionIdMissing()
    {
        Guid ownerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IAppRepository> repository = new();
        Mock<IDatabricksApiService> databricksApi = new();
        Mock<IDatabricksWorkspaceConnectionValidator> validator = new();
        Mock<IDatabricksAppProvisioningService> provisioning = new();

        AppService sut = new AppService(
            repository.Object,
            NullLogger<AppService>.Instance,
            databricksApi.Object,
            validator.Object,
            provisioning.Object,
            CreatePermissiveLimitService().Object,
            CreatePermissiveTenantGuard().Object);

        CreateAppRequest request = new CreateAppRequest
        {
            AppName = "VDAB App",
            WorkspaceConnectionId = 0,
            DatabricksAppMode = DatabricksAppCreationMode.LinkExisting,
            DatabricksAppName = "existing"
        };

        Result<AppDto> result = await sut.CreateAppAsync(request, ownerId, tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
        validator.Verify(x => x.ValidateWorkspaceConnectionForTenantAsync(It.IsAny<Guid>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task CreateAppAsync_CreateNew_ReturnsPartialProvisionErrorWhenDbInsertFails()
    {
        Guid ownerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IAppRepository> repository = new();
        repository
            .Setup(x => x.AddAsync(It.IsAny<App>()))
            .ThrowsAsync(new InvalidOperationException("db failure"));

        Mock<IDatabricksApiService> databricksApi = new();

        Mock<IDatabricksWorkspaceConnectionValidator> validator = new();
        validator
            .Setup(x => x.ValidateWorkspaceConnectionForTenantAsync(tenantId, 5))
            .ReturnsAsync(Result.Ok(new DatabricksConnection
            {
                PkId = 5,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test",
                WorkspaceDisplayName = "Test Workspace"
            }));

        Mock<IDatabricksAppProvisioningService> provisioning = new();
        provisioning
            .Setup(x => x.CreateDatabricksAppAsync(
                ownerId,
                "https://dbc.test",
                5,
                "new-dbx-app",
                null,
                null,
                It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(new CreatedDatabricksAppDto
            {
                Name = "new-dbx-app-canonical"
            }));

        AppService sut = new AppService(
            repository.Object,
            NullLogger<AppService>.Instance,
            databricksApi.Object,
            validator.Object,
            provisioning.Object,
            CreatePermissiveLimitService().Object,
            CreatePermissiveTenantGuard().Object);

        CreateAppRequest request = new CreateAppRequest
        {
            AppName = "VDAB App",
            WorkspaceConnectionId = 5,
            DatabricksAppMode = DatabricksAppCreationMode.CreateNew,
            DatabricksAppName = "new-dbx-app"
        };

        Result<AppDto> result = await sut.CreateAppAsync(request, ownerId, tenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<PartialDatabricksProvisionError>());
        PartialDatabricksProvisionError error = result.Errors.OfType<PartialDatabricksProvisionError>().First();
        Assert.Equal("new-dbx-app-canonical", error.DatabricksAppName);
    }
}
