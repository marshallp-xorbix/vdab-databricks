using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

public class AppControllerIdentityTests
{
    [Fact]
    public async Task GetById_MissingTenantClaim_ReturnsUnauthorized()
    {
        Guid userId = Guid.NewGuid();
        Mock<IAppService> appService = new();

        AppController controller = new(appService.Object, Mock.Of<IAppImportExportService>(), NullLogger<AppController>.Instance)
        {
            ControllerContext = ControllerTestHelpers.BuildContext(userId, tenantId: null),
        };

        IActionResult response = await controller.GetById(1);

        Assert.Equal(StatusCodes.Status401Unauthorized, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        appService.Verify(service => service.GetAppByIdAsync(It.IsAny<int>(), It.IsAny<Guid>()), Times.Never);
    }
}
