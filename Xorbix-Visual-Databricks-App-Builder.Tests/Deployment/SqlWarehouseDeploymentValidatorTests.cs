using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.Deployment;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Deployment;

public class SqlWarehouseDeploymentValidatorTests
{
    [Fact]
    public void RequiresUnitySqlWarehouse_ReturnsTrue_WhenUnityCatalogBindingPresent()
    {
        List<VdabComponentDto> components =
        [
            new BarChartComponentDto
            {
                Id = "c1",
                CodeName = "bar1",
                Type = ComponentType.BarChart,
                Category = ComponentCategory.Visualization,
                Props = new BarChartProps(),
                Bindings = new Dictionary<string, BindingDto>
                {
                    [WorkflowParserTokens.SqlSourceKind.UnityCatalogTable] = CreateUnityCatalogBinding()
                }
            }
        ];

        Assert.True(SqlWarehouseDeploymentValidator.RequiresUnitySqlWarehouse(components, new WorkflowDefinitionDto()));
    }

    [Fact]
    public void RequiresUnitySqlWarehouse_ReturnsFalse_WhenUnityCatalogBindingIncomplete()
    {
        List<VdabComponentDto> components =
        [
            new BarChartComponentDto
            {
                Id = "c1",
                CodeName = "bar1",
                Type = ComponentType.BarChart,
                Category = ComponentCategory.Visualization,
                Props = new BarChartProps(),
                Bindings = new Dictionary<string, BindingDto>
                {
                    [WorkflowParserTokens.SqlSourceKind.UnityCatalogTable] = new BindingDto
                    {
                        BindingType = WorkflowParserTokens.SqlSourceKind.UnityCatalogTable,
                        Source = new BindingSourceDto
                        {
                            Kind = "resource",
                            Resource = new ResourceBindingSourceDto
                            {
                                Type = "table",
                                Catalog = "main",
                                Schema = null,
                                Table = "sales"
                            }
                        }
                    }
                }
            }
        ];

        Assert.False(SqlWarehouseDeploymentValidator.RequiresUnitySqlWarehouse(components, new WorkflowDefinitionDto()));
    }

    [Fact]
    public void RequiresUnitySqlWarehouse_ReturnsFalse_WhenOnlyLakebaseBindingPresent()
    {
        List<VdabComponentDto> components =
        [
            new BarChartComponentDto
            {
                Id = "c1",
                CodeName = "bar1",
                Type = ComponentType.BarChart,
                Category = ComponentCategory.Visualization,
                Props = new BarChartProps(),
                Bindings = new Dictionary<string, BindingDto>
                {
                    [WorkflowParserTokens.SqlSourceKind.LakebaseProvisionedDatabase] = new BindingDto
                    {
                        BindingType = WorkflowParserTokens.SqlSourceKind.LakebaseProvisionedDatabase,
                        Source = new BindingSourceDto
                        {
                            Kind = "resource",
                            Resource = new ResourceBindingSourceDto
                            {
                                Type = "table",
                                Catalog = "db",
                                Schema = "public",
                                Table = "sales",
                                Database = "db"
                            }
                        }
                    }
                }
            }
        ];

        Assert.False(SqlWarehouseDeploymentValidator.RequiresUnitySqlWarehouse(components, new WorkflowDefinitionDto()));
    }

    [Fact]
    public void RequiresUnitySqlWarehouse_ReturnsFalse_WhenNoBindings()
    {
        Assert.False(SqlWarehouseDeploymentValidator.RequiresUnitySqlWarehouse(
            [
                new BarChartComponentDto
                {
                    Id = "c1",
                    CodeName = "bar1",
                    Type = ComponentType.BarChart,
                    Category = ComponentCategory.Visualization,
                    Props = new BarChartProps()
                }
            ],
            new WorkflowDefinitionDto()));
    }

    [Fact]
    public void RequiresUnitySqlWarehouse_ReturnsTrue_WhenSaveToTableTargetsUnityCatalog()
    {
        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_save",
                "parameter_form",
                "onSubmit",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "save",
                        "SaveToTable",
                        new Dictionary<string, object?>
                        {
                            ["sourceFormComponentCodeName"] = "parameter_form",
                            ["targetTable"] = new Dictionary<string, object?>
                            {
                                ["tableType"] = "unityCatalogTable",
                                ["workspaceConnectionId"] = 1,
                                ["catalog"] = "main",
                                ["schema"] = "default",
                                ["table"] = "orders",
                            },
                            ["excludedColumns"] = new List<object?>(),
                            ["columnMappings"] = new List<object?>
                            {
                                new Dictionary<string, object?>
                                {
                                    ["formChildComponentCodeName"] = "name_input",
                                    ["targetColumnName"] = "name",
                                },
                            },
                        }),
                }));

        Assert.True(SqlWarehouseDeploymentValidator.RequiresUnitySqlWarehouse([], workflowDefinition));
    }

    [Fact]
    public void RequiresUnitySqlWarehouse_ReturnsTrue_WhenRunSqlUsesUnityCatalogBuildSql()
    {
        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_run",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "build",
                        "BuildSql",
                        new Dictionary<string, object?>
                        {
                            ["sqlSourceKind"] = "unityCatalogTable",
                            ["sqlTemplate"] = "SELECT 1",
                        }),
                    WorkflowTestDefinitionFactory.CreateNode(
                        "run",
                        "RunSql",
                        new Dictionary<string, object?>
                        {
                            ["statement"] = new Dictionary<string, object?>
                            {
                                ["sourceActionType"] = "BuildSql",
                                ["nodeId"] = "build",
                            },
                        }),
                },
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateEdge("build", "run", "onSuccess"),
                }));

        Assert.True(SqlWarehouseDeploymentValidator.RequiresUnitySqlWarehouse([], workflowDefinition));
    }

    [Fact]
    public void RequiresUnitySqlWarehouse_ReturnsFalse_WhenRunSqlUsesLakebaseOnly()
    {
        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_lb",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "build",
                        "BuildSql",
                        new Dictionary<string, object?>
                        {
                            ["sqlSourceKind"] = "lakebaseProvisionedDatabase",
                            ["sqlTemplate"] = "SELECT 1",
                            ["lakebaseAppResourceName"] = "db_res",
                            ["lakebaseDatabaseName"] = "appdb",
                        }),
                    WorkflowTestDefinitionFactory.CreateNode(
                        "run",
                        "RunSql",
                        new Dictionary<string, object?>
                        {
                            ["statement"] = new Dictionary<string, object?>
                            {
                                ["sourceActionType"] = "BuildSql",
                                ["nodeId"] = "build",
                            },
                        }),
                },
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateEdge("build", "run", "onSuccess"),
                }));

        Assert.False(SqlWarehouseDeploymentValidator.RequiresUnitySqlWarehouse([], workflowDefinition));
    }

    [Fact]
    public async Task ResolveResourceKeyAsync_Fails_WhenUnitySqlRequiredAndNoWarehouseResource()
    {
        Mock<IAppActionService> appActionService = new();
        appActionService
            .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), 42))
            .ReturnsAsync(Result.Ok(CreateAppDetails([])));

        Result<string> result = await SqlWarehouseDeploymentValidator.ResolveResourceKeyAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            42,
            [CreateUnityCatalogBarChart()],
            new WorkflowDefinitionDto(),
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsFailed);
        Assert.Contains("SQL warehouse", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("service principal", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Your Databricks user", result.Errors[0].Message, StringComparison.Ordinal);
        Assert.DoesNotContain(".documentation/", result.Errors[0].Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ResolveResourceKeyAsync_PrefersDefaultWarehouseKey()
    {
        Mock<IAppActionService> appActionService = new();
        appActionService
            .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), 42))
            .ReturnsAsync(Result.Ok(CreateAppDetails(
            [
                "other-warehouse",
                DatabricksAppsSqlWarehouseResource.DefaultResourceKey,
            ])));

        Result<string> result = await SqlWarehouseDeploymentValidator.ResolveResourceKeyAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            42,
            [CreateUnityCatalogBarChart()],
            new WorkflowDefinitionDto(),
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsSuccess);
        Assert.Equal(DatabricksAppsSqlWarehouseResource.DefaultResourceKey, result.Value);
    }

    [Fact]
    public async Task ResolveResourceKeyAsync_ReturnsAlternateWarehouseKey_WhenDefaultMissing()
    {
        Mock<IAppActionService> appActionService = new();
        appActionService
            .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), 42))
            .ReturnsAsync(Result.Ok(CreateAppDetails(["warehouse-prod"])));

        Result<string> result = await SqlWarehouseDeploymentValidator.ResolveResourceKeyAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            42,
            [CreateUnityCatalogBarChart()],
            new WorkflowDefinitionDto(),
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsSuccess);
        Assert.Equal("warehouse-prod", result.Value);
    }

    [Fact]
    public async Task ResolveResourceKeyAsync_ReturnsDefault_WhenUnitySqlNotRequired()
    {
        Mock<IAppActionService> appActionService = new();

        Result<string> result = await SqlWarehouseDeploymentValidator.ResolveResourceKeyAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            42,
            [],
            new WorkflowDefinitionDto(),
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsSuccess);
        Assert.Equal(DatabricksAppsSqlWarehouseResource.DefaultResourceKey, result.Value);
        appActionService.Verify(
            service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task ResolveResourceKeyAsync_ReturnsDefault_WhenIncompleteUnityBinding()
    {
        Mock<IAppActionService> appActionService = new();
        BarChartComponentDto incompleteChart = new()
        {
            Id = "c1",
            CodeName = "bar1",
            Type = ComponentType.BarChart,
            Category = ComponentCategory.Visualization,
            Props = new BarChartProps(),
            Bindings = new Dictionary<string, BindingDto>
            {
                [WorkflowParserTokens.SqlSourceKind.UnityCatalogTable] = new BindingDto
                {
                    BindingType = WorkflowParserTokens.SqlSourceKind.UnityCatalogTable,
                    Source = new BindingSourceDto
                    {
                        Kind = "resource",
                        Resource = new ResourceBindingSourceDto
                        {
                            Type = "table",
                            Catalog = "main",
                            Schema = " ",
                            Table = "sales"
                        }
                    }
                }
            }
        };

        Result<string> result = await SqlWarehouseDeploymentValidator.ResolveResourceKeyAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            42,
            [incompleteChart],
            new WorkflowDefinitionDto(),
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsSuccess);
        Assert.Equal(DatabricksAppsSqlWarehouseResource.DefaultResourceKey, result.Value);
        appActionService.Verify(
            service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task ResolveResourceKeyAsync_Fails_WhenAppDetailsFailAndUnitySqlRequired()
    {
        Mock<IAppActionService> appActionService = new();
        appActionService
            .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), 42))
            .ReturnsAsync(Result.Fail<DatabricksAppResponse>(new BadRequestError("details unavailable")));

        Result<string> result = await SqlWarehouseDeploymentValidator.ResolveResourceKeyAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            42,
            [CreateUnityCatalogBarChart()],
            new WorkflowDefinitionDto(),
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsFailed);
        Assert.Contains("details unavailable", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    private static BarChartComponentDto CreateUnityCatalogBarChart()
    {
        return new BarChartComponentDto
        {
            Id = "c1",
            CodeName = "bar1",
            Type = ComponentType.BarChart,
            Category = ComponentCategory.Visualization,
            Props = new BarChartProps(),
            Bindings = new Dictionary<string, BindingDto>
            {
                [WorkflowParserTokens.SqlSourceKind.UnityCatalogTable] = CreateUnityCatalogBinding()
            }
        };
    }

    private static BindingDto CreateUnityCatalogBinding()
    {
        return new BindingDto
        {
            BindingType = WorkflowParserTokens.SqlSourceKind.UnityCatalogTable,
            Source = new BindingSourceDto
            {
                Kind = "resource",
                Resource = new ResourceBindingSourceDto
                {
                    Type = "table",
                    Catalog = "main",
                    Schema = "default",
                    Table = "sales"
                }
            }
        };
    }

    private static DatabricksAppResponse CreateAppDetails(IEnumerable<string> warehouseKeys)
    {
        return new DatabricksAppResponse
        {
            Name = "app",
            AppSettings = new AppSettingsDetailsDto
            {
                Resources = warehouseKeys
                    .Select(key => new NormalizedAppResourceDto
                    {
                        Name = key,
                        Kind = DatabricksAppResourceKinds.SqlWarehouse,
                    })
                    .ToList()
            }
        };
    }
}
