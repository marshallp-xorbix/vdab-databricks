using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

public class AppControllerImportExportTests
{
    private static AppController CreateController(
        Mock<IAppImportExportService> importExportService,
        Guid userId,
        Guid tenantId,
        params string[] roles)
    {
        AppController controller = new(
            Mock.Of<IAppService>(),
            importExportService.Object,
            NullLogger<AppController>.Instance)
        {
            ControllerContext = ControllerTestHelpers.BuildContext(userId, tenantId, roles),
        };
        return controller;
    }

    [Fact]
    public async Task ExportAll_DelegatesToService_AndReturnsBundle()
    {
        // Note: the [Authorize(Policy = RequireAdministratorRole)] attribute is enforced
        // by the ASP.NET authorization middleware, not within the action body, so it is
        // covered by integration tests rather than this direct method-call unit test.
        Guid tenantId = Guid.NewGuid();
        Mock<IAppImportExportService> importExportService = new();
        importExportService
            .Setup(x => x.ExportAppsByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new ExportBundleDto
            {
                Type = ExportBundleTypes.Apps,
                ExportedAt = DateTime.UtcNow,
                Apps = []
            }));

        AppController controller = CreateController(
            importExportService,
            Guid.NewGuid(),
            tenantId,
            AuthRoles.Administrator);

        var result = await controller.ExportAll(CancellationToken.None);

        Assert.Equal(200, ControllerTestHelpers.StatusCodeOf(result.Result));
        importExportService.Verify(
            x => x.ExportAppsByTenantAsync(tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
