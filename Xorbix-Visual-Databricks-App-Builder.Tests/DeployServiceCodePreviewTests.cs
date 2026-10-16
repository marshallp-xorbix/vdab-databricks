using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class DeployServicePreviewTests
{
    private static readonly Guid TestTenantId = Guid.NewGuid();

    [Fact]
    public async Task PreviewGeneratedCodeAsync_ReturnsGeneratedFiles_WhenCodeNamesAreValid()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();

        DeployService deployService = CreateDeployService(templateService.Object, null);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 11,
            AppName = "Preview App",
            FormComponents = new List<VdabComponentDto>
            {
                CreateTextInputComponent("comp-1", "customer_name")
            }
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(4, result.Value.Files.Count);
        Assert.False(string.IsNullOrWhiteSpace(result.Value.PrebuiltModulesLibrarySource));
        Assert.Contains("def change_text", result.Value.PrebuiltModulesLibrarySource);
        Assert.Contains(result.Value.Files, file => file.Path == "app.py" && file.Content == "print('preview')");
        Assert.Contains(
            result.Value.Files,
            file => file.Path == "custom_modules.py" && file.Content == CustomModulesTemplate.ResolveContent(null));
        Assert.Contains(result.Value.Files, file => file.Path == "requirements.txt" && file.Content == "streamlit\n");
        Assert.Contains(result.Value.Files, file => file.Path == "app.yaml" && file.Content == "command: []");
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_ReturnsPreviewWithErrors_WhenWorkflowGenerationFails()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();
        templateService
            .SetupSequence(service => service.GenerateStreamlitAppFromVdabComponents(
                It.IsAny<List<VdabComponentDto>>(),
                It.IsAny<string>(),
                It.IsAny<WorkflowDefinitionDto>(),
                It.IsAny<int>()))
            .Returns(Result.Fail<string>(new ValidationError("Workflow 'workflow_6' references missing trigger component 'button2'.")))
            .Returns(Result.Ok("print('preview without workflows')"));

        DeployService deployService = CreateDeployService(templateService.Object, null);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 11,
            AppName = "Preview App",
            FormComponents = new List<VdabComponentDto>
            {
                CreateTextInputComponent("comp-1", "customer_name")
            },
            WorkflowDefinition = new WorkflowDefinitionDto
            {
                Workflows = new List<WorkflowDto>
                {
                    new WorkflowDto
                    {
                        CodeName = "workflow_6",
                        Trigger = new WorkflowTriggerDto
                        {
                            ComponentCodeName = "button2",
                            EventKey = "onClick",
                        },
                    },
                },
            },
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsSuccess);
        Assert.Contains("missing trigger component 'button2'", result.Value.PreviewErrors[0]);
        Assert.Contains(result.Value.Files, file => file.Path == "app.py" && file.Content == "print('preview without workflows')");
        Assert.Contains(result.Value.Files, file => file.Path == "preview-errors.txt" && file.Content.Contains("workflow_6"));
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_LoadsCustomModules_FromAppRecord_WhenRequestOmitsInlineCode()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();
        Mock<IAppService> appService = new();
        appService
            .Setup(service => service.GetAppByIdAsync(42, TestTenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                Id = 42,
                OwnerId = Guid.NewGuid(),
                AppName = "App42",
                WorkspaceConnectionId = 1,
                CustomModulesCode = "def stored_handler(ctx):\n    return {}\n",
            }));

        DeployService deployService = CreateDeployService(templateService.Object, null, appService.Object);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 42,
            AppName = "Preview App",
            FormComponents = new List<VdabComponentDto>
            {
                CreateTextInputComponent("comp-1", "customer_name"),
            },
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsSuccess);
        string expected = CustomModulesTemplate.ResolveContent("def stored_handler(ctx):\n    return {}\n");
        Assert.Contains(result.Value.Files, file => file.Path == "custom_modules.py" && file.Content == expected);
        appService.Verify(service => service.GetAppByIdAsync(42, TestTenantId), Times.Once);
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_Fails_WhenCodeNameFormatIsInvalid()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();

        DeployService deployService = CreateDeployService(templateService.Object, null);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 12,
            FormComponents = new List<VdabComponentDto>
            {
                CreateTextInputComponent("comp-1", "bad-name")
            }
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsFailed);
        CodeNameValidationError? validationError = result.Errors.OfType<CodeNameValidationError>().FirstOrDefault();
        Assert.NotNull(validationError);
        Assert.Equal("formComponents[0].codeName", validationError!.Field);
        Assert.Equal("InvalidFormat", validationError.Violation);
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_Fails_WhenCodeNamesAreDuplicated()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();

        DeployService deployService = CreateDeployService(templateService.Object, null);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 13,
            FormComponents = new List<VdabComponentDto>
            {
                CreateTextInputComponent("comp-1", "shared_name"),
                CreateTextInputComponent("comp-2", "shared_name")
            }
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsFailed);
        List<CodeNameValidationError> duplicateErrors = result.Errors.OfType<CodeNameValidationError>().Where(error => error.Violation == "Duplicate").ToList();
        Assert.Equal(2, duplicateErrors.Count);
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_Fails_WhenCodeNameIsMissing()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();

        DeployService deployService = CreateDeployService(templateService.Object, null);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 14,
            FormComponents = new List<VdabComponentDto>
            {
                CreateTextInputComponent("comp-1", null)
            }
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsFailed);
        CodeNameValidationError? validationError = result.Errors.OfType<CodeNameValidationError>().FirstOrDefault();
        Assert.NotNull(validationError);
        Assert.Equal("Required", validationError!.Violation);
    }

    [Fact]
    public void CodeNameUtility_ResolveVariableName_Throws_WhenCodeNameMissing()
    {
        TextInputComponentDto component = CreateTextInputComponent("input.main", null);

        Assert.Throws<InvalidOperationException>(() => CodeNameUtility.ResolveVariableName(component));
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_ReturnsThemeFile_WhenThemeConfigProvided()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();

        DeployService deployService = CreateDeployService(templateService.Object, null);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 15,
            AppName = "Preview App",
            ThemeConfig = new StreamlitThemeConfig
            {
                PrimaryColor = "#111111",
                BackgroundColor = "#222222",
                SecondaryBackgroundColor = "#333333",
                TextColor = "#444444"
            },
            FormComponents = new List<VdabComponentDto>
            {
                CreateTextInputComponent("comp-1", "customer_name")
            }
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(5, result.Value.Files.Count);
        Assert.Contains(result.Value.Files, file => file.Path == ".streamlit/config.toml");
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_Fails_WhenGenieChatNotBound()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();
        Mock<IAppActionService> appActions = new();

        DeployService deployService = CreateDeployService(templateService.Object, appActions.Object);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 20,
            FormComponents = new List<VdabComponentDto>
            {
                new GenieChatComponentDto
                {
                    Id = "g1",
                    CodeName = "genieChat1",
                    Type = ComponentType.GenieChat,
                    Category = ComponentCategory.Visualization,
                    Props = new GenieChatProps { GenieSpaceAppResourceName = string.Empty },
                },
            },
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsFailed);
        appActions.Verify(
            service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_Fails_WhenGenieResourceNotDeclared()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();
        Mock<IAppActionService> appActions = new();
        appActions
            .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>()))
            .ReturnsAsync(Result.Ok(new DatabricksAppResponse
            {
                AppSettings = new AppSettingsDetailsDto
                {
                    Resources =
                    [
                        new NormalizedAppResourceDto
                        {
                            Kind = DatabricksAppResourceKinds.GenieSpace,
                            Name = "other-space",
                        },
                    ],
                },
            }));

        DeployService deployService = CreateDeployService(templateService.Object, appActions.Object);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 21,
            FormComponents = new List<VdabComponentDto>
            {
                new GenieChatComponentDto
                {
                    Id = "g1",
                    CodeName = "genieChat1",
                    Type = ComponentType.GenieChat,
                    Category = ComponentCategory.Visualization,
                    Props = new GenieChatProps { GenieSpaceAppResourceName = "my-space" },
                },
            },
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsFailed);
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_ThreadsStoredThemePageWidth_ToTemplateService()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();
        Mock<IAppService> appService = new();
        appService
            .Setup(service => service.GetAppByNameAsync("Preview App", TestTenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                AppName = "Preview App",
                Theme = "{\"pageWidth\":\"9999\"}"
            }));
        appService
            .Setup(service => service.GetAppByIdAsync(It.IsAny<int>(), It.IsAny<Guid>()))
            .ReturnsAsync(Result.Ok<AppDto?>(null));

        DeployService deployService = CreateDeployService(templateService.Object, null, appService.Object);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 30,
            AppName = "Preview App",
            FormComponents = new List<VdabComponentDto> { CreateTextInputComponent("comp-1", "customer_name") }
        };

        await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        templateService.Verify(service => service.GenerateStreamlitAppFromVdabComponents(
            It.IsAny<List<VdabComponentDto>>(),
            It.IsAny<string>(),
            It.IsAny<WorkflowDefinitionDto>(),
            PageWidthBounds.MaxPixels), Times.Once);
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_PrefersLiveThemePageWidth_OverStoredTheme()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();
        Mock<IAppService> appService = new();
        appService
            .Setup(service => service.GetAppByNameAsync("Preview App", TestTenantId))
            .ReturnsAsync(Result.Ok<AppDto?>(new AppDto
            {
                AppName = "Preview App",
                Theme = "{\"pageWidth\":\"9999\"}"
            }));
        appService
            .Setup(service => service.GetAppByIdAsync(It.IsAny<int>(), It.IsAny<Guid>()))
            .ReturnsAsync(Result.Ok<AppDto?>(null));

        DeployService deployService = CreateDeployService(templateService.Object, null, appService.Object);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 31,
            AppName = "Preview App",
            ThemeConfig = new StreamlitThemeConfig { PageWidth = 1200 },
            FormComponents = new List<VdabComponentDto> { CreateTextInputComponent("comp-1", "customer_name") }
        };

        await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        templateService.Verify(service => service.GenerateStreamlitAppFromVdabComponents(
            It.IsAny<List<VdabComponentDto>>(),
            It.IsAny<string>(),
            It.IsAny<WorkflowDefinitionDto>(),
            1200), Times.Once);
        appService.Verify(
            service => service.GetAppByNameAsync(It.IsAny<string>(), It.IsAny<Guid>()),
            Times.Never);
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_PassesResolvedWarehouseKey_ToAppYaml()
    {
        string? capturedWarehouseKey = null;
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();
        templateService
            .Setup(service => service.GenerateAppYamlFile(
                It.IsAny<List<VdabComponentDto>?>(),
                It.IsAny<WorkflowDefinitionDto>(),
                It.IsAny<string?>()))
            .Callback<List<VdabComponentDto>?, WorkflowDefinitionDto, string?>((_, _, key) => capturedWarehouseKey = key)
            .Returns("command: []");

        Mock<IAppActionService> appActionService = new();
        appActionService
            .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), 11))
            .ReturnsAsync(Result.Ok(new DatabricksAppResponse
            {
                Name = "preview-app",
                AppSettings = new AppSettingsDetailsDto
                {
                    Resources =
                    [
                        new NormalizedAppResourceDto
                        {
                            Name = "warehouse-prod",
                            Kind = DatabricksAppResourceKinds.SqlWarehouse,
                        },
                    ],
                },
            }));

        DeployService deployService = CreateDeployService(templateService.Object, appActionService.Object);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 11,
            AppName = "Preview App",
            FormComponents =
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
                                    Schema = "default",
                                    Table = "sales",
                                },
                            },
                        },
                    },
                },
            ],
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal("warehouse-prod", capturedWarehouseKey);
    }

    [Fact]
    public async Task PreviewGeneratedCodeAsync_Fails_WhenUnitySqlRequiresWarehouseAndNoneConfigured()
    {
        Mock<IStreamlitTemplateService> templateService = CreateTemplateService();
        Mock<IAppActionService> appActionService = new();
        appActionService
            .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), 22))
            .ReturnsAsync(Result.Ok(new DatabricksAppResponse
            {
                Name = "preview-app",
                AppSettings = new AppSettingsDetailsDto
                {
                    Resources = [],
                },
            }));

        DeployService deployService = CreateDeployService(templateService.Object, appActionService.Object);
        GeneratedCodePreviewRequest request = new GeneratedCodePreviewRequest
        {
            AppId = 22,
            AppName = "Preview App",
            FormComponents =
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
                                    Schema = "default",
                                    Table = "sales",
                                },
                            },
                        },
                    },
                },
            ],
        };

        Result<GeneratedCodePreviewResult> result = await deployService.PreviewGeneratedCodeAsync(request, Guid.Empty, TestTenantId);

        Assert.True(result.IsFailed);
        Assert.Contains("SQL warehouse", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
        templateService.Verify(
            service => service.GenerateStreamlitAppFromVdabComponents(
                It.IsAny<List<VdabComponentDto>>(),
                It.IsAny<string>(),
                It.IsAny<WorkflowDefinitionDto>(),
                It.IsAny<int>()),
            Times.Never);
    }

    private static Mock<IStreamlitTemplateService> CreateTemplateService()
    {
        Mock<IStreamlitTemplateService> templateService = new();
        templateService
            .Setup(service => service.GenerateStreamlitAppFromVdabComponents(
                It.IsAny<List<VdabComponentDto>>(),
                It.IsAny<string>(),
                It.IsAny<WorkflowDefinitionDto>(),
                It.IsAny<int>()))
            .Returns(Result.Ok("print('preview')"));
        templateService
            .Setup(service => service.GenerateRequirementsFile(It.IsAny<List<VdabComponentDto>?>(), It.IsAny<WorkflowDefinitionDto>()))
            .Returns("streamlit\n");
        templateService
            .Setup(service => service.GenerateAppYamlFile(
                It.IsAny<List<VdabComponentDto>?>(),
                It.IsAny<WorkflowDefinitionDto>(),
                It.IsAny<string?>()))
            .Returns("command: []");
        templateService
            .Setup(service => service.GenerateStreamlitConfig(It.IsAny<StreamlitThemeConfig>()))
            .Returns("[theme]");
        templateService
            .Setup(service => service.GenerateCustomModulesFile(It.IsAny<string?>()))
            .Returns((string? raw) => CustomModulesTemplate.ResolveContent(raw));

        return templateService;
    }

    private static DeployService CreateDeployService(
        IStreamlitTemplateService templateService,
        IAppActionService? appActionService,
        IAppService? appService = null)
    {
        Mock<IDatabricksApiService> databricksApiService = new();
        Mock<IDatabricksWorkspaceConnectionValidator> workspaceConnectionValidator = new();
        workspaceConnectionValidator
            .Setup(validator => validator.ValidateWorkspaceConnectionForTenantAsync(It.IsAny<Guid>(), It.IsAny<int>()))
            .ReturnsAsync((Guid tenantId, int workspaceConnectionId) => Result.Ok(new Xorbix_Visual_Databricks_App_Builder.Models.EF.DatabricksConnection
            {
                PkId = workspaceConnectionId,
                TenantId = tenantId,
                WorkspaceUrl = "https://dbc.test.cloud.databricks.com",
                WorkspaceDisplayName = "Test"
            }));
        IAppService app;
        if (appService != null)
        {
            app = appService;
        }
        else
        {
            Mock<IAppService> defaultApp = new();
            defaultApp
                .Setup(service => service.GetAppByIdAsync(It.IsAny<int>(), It.IsAny<Guid>()))
                .ReturnsAsync(Result.Ok<AppDto?>(null));
            app = defaultApp.Object;
        }

        IAppActionService actions;
        if (appActionService != null)
        {
            actions = appActionService;
        }
        else
        {
            Mock<IAppActionService> defaultActions = new();
            defaultActions
                .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>()))
                .ReturnsAsync(Result.Ok(new DatabricksAppResponse
                {
                    Name = "preview-app",
                    AppSettings = new AppSettingsDetailsDto()
                }));
            actions = defaultActions.Object;
        }

        Mock<ITenantLimitService> tenantLimitService = new();
        tenantLimitService
            .Setup(service => service.EnsureSubscriptionActiveAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        return new DeployService(
            databricksApiService.Object,
            templateService,
            app,
            actions,
            tenantLimitService.Object,
            workspaceConnectionValidator.Object,
            NullLogger<DeployService>.Instance);
    }

    private static TextInputComponentDto CreateTextInputComponent(string id, string? codeName)
    {
        return new TextInputComponentDto
        {
            Id = id,
            CodeName = codeName ?? string.Empty,
            Type = ComponentType.TextInput,
            Category = ComponentCategory.Controls,
            Props = new TextInputProps
            {
                Label = "Label",
                Multiline = false,
            }
        };
    }
}
