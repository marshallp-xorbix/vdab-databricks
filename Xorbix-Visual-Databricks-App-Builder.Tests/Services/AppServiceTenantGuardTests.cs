using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

public class AppServiceTenantGuardTests
{
    [Fact]
    public async Task GetAppByIdAsync_WrongTenant_ReturnsForbidden()
    {
        Guid appTenantId = Guid.NewGuid();
        Guid callerTenantId = Guid.NewGuid();

        App app = new()
        {
            PkId = 7,
            AppName = "Test App",
            TenantId = appTenantId,
            OwnerId = Guid.NewGuid(),
        };

        Mock<IAppRepository> repository = new();
        repository.Setup(r => r.GetByIdAsync(7)).ReturnsAsync(app);

        Mock<ITenantLimitService> limitService = new();
        AppService sut = new(
            repository.Object,
            NullLogger<AppService>.Instance,
            Mock.Of<IDatabricksApiService>(),
            Mock.Of<IDatabricksWorkspaceConnectionValidator>(),
            Mock.Of<IDatabricksAppProvisioningService>(),
            limitService.Object,
            new TenantResourceGuard());

        Result<AppDto?> result = await sut.GetAppByIdAsync(7, callerTenantId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
    }
}
