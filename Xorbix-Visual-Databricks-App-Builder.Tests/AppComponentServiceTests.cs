using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AppComponent;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class AppComponentServiceTests
{
    private static readonly Guid TestTenantId = Guid.NewGuid();

    [Fact]
    public async Task GetComponentsByContextAsync_GroupsRecursiveModalDescendants()
    {
        List<AppComponent> components = new List<AppComponent>
        {
            CreateComponent(100, ComponentType.Modal, children: "[\"200\"]"),
            CreateComponent(200, ComponentType.Form, children: "[\"300\"]"),
            CreateComponent(300, ComponentType.TextInput),
            CreateComponent(400, ComponentType.Button)
        };

        AppComponentService service = CreateService(components);

        FluentResults.Result<Dictionary<string, List<AppComponentDto>>> result = await service.GetComponentsByContextAsync(1, TestTenantId);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value["__modals"]);
        Assert.Equal(new[] { 200, 300 }, result.Value["modal_100"].Select(component => component.Id).OrderBy(id => id));
        Assert.Equal(new[] { 400 }, result.Value["page_1"].Select(component => component.Id));
    }

    [Fact]
    public async Task GetComponentsByContextAsync_FailsWhenComponentOwnedByMultipleContexts()
    {
        List<AppComponent> components = new List<AppComponent>
        {
            CreateComponent(100, ComponentType.Modal, children: "[\"200\"]"),
            CreateComponent(101, ComponentType.Modal, children: "[\"200\"]"),
            CreateComponent(200, ComponentType.Button)
        };

        AppComponentService service = CreateService(components);

        FluentResults.Result<Dictionary<string, List<AppComponentDto>>> result = await service.GetComponentsByContextAsync(1, TestTenantId);

        Assert.True(result.IsFailed);
        Assert.Contains("multiple contexts", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetComponentsByContextAsync_FailsWhenChildReferenceMissing()
    {
        List<AppComponent> components = new List<AppComponent>
        {
            CreateComponent(100, ComponentType.Modal, children: "[\"999\"]")
        };

        AppComponentService service = CreateService(components);

        FluentResults.Result<Dictionary<string, List<AppComponentDto>>> result = await service.GetComponentsByContextAsync(1, TestTenantId);

        Assert.True(result.IsFailed);
        Assert.Contains("does not exist", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetComponentsByContextAsync_FailsWhenCycleDetected()
    {
        List<AppComponent> components = new List<AppComponent>
        {
            CreateComponent(100, ComponentType.Modal, children: "[\"200\"]"),
            CreateComponent(200, ComponentType.Form, children: "[\"300\"]"),
            CreateComponent(300, ComponentType.Rows, children: "[\"200\"]")
        };

        AppComponentService service = CreateService(components);

        FluentResults.Result<Dictionary<string, List<AppComponentDto>>> result = await service.GetComponentsByContextAsync(1, TestTenantId);

        Assert.True(result.IsFailed);
        Assert.Contains("cycle", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    private static AppComponentService CreateService(IEnumerable<AppComponent> components)
    {
        Mock<IAppComponentRepository> appComponentRepository = new Mock<IAppComponentRepository>();
        appComponentRepository
            .Setup(repository => repository.GetByAppIdAsync(It.IsAny<int>()))
            .ReturnsAsync(components);

        Mock<IAppRepository> appRepository = new Mock<IAppRepository>();

        Mock<IDatabricksConnectionRepository> databricksConnectionRepository = new Mock<IDatabricksConnectionRepository>();
        Mock<IAppService> appService = new Mock<IAppService>();
        appService
            .Setup(service => service.GetAppByIdAsync(It.IsAny<int>(), TestTenantId))
            .ReturnsAsync(FluentResults.Result.Ok<Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App.AppDto?>(
                new Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App.AppDto
                {
                    Id = 1,
                    AppName = "App",
                    TenantId = TestTenantId
                }));

        return new AppComponentService(
            appComponentRepository.Object,
            appRepository.Object,
            databricksConnectionRepository.Object,
            appService.Object,
            NullLogger<AppComponentService>.Instance);
    }

    private static AppComponent CreateComponent(
        int id,
        ComponentType type,
        string? children = null)
    {
        return new AppComponent
        {
            PkId = id,
            AppId = 1,
            ComponentType = type,
            ComponentVersion = 1,
            Properties = "{}",
            Children = children
        };
    }
}
