using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Validation;

public class WorkflowActionValidationTests
{
    [Fact]
    public void Validate_FailsWhenShowModalTargetIsMissing()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_show_modal",
                    "open_claims_button",
                    "onClick",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "show-modal",
                            "ShowModal",
                            new Dictionary<string, object?>
                            {
                                ["modalCodeName"] = "claims_modal",
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateButtonComponent(),
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components);

        Assert.True(result.IsFailed);
        Assert.Contains("references missing modal 'claims_modal'", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenSaveToTableTriggerIsNotForm()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_save_to_table",
                    "status_filter",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "save-1",
                            "SaveToTable",
                            new Dictionary<string, object?>
                            {
                                ["sourceFormComponentCodeName"] = "parameter_form",
                                ["targetTable"] = new Dictionary<string, object?>
                                {
                                    ["tableType"] = "unityCatalogTable",
                                    ["workspaceConnectionId"] = 1,
                                    ["catalog"] = "main",
                                    ["schema"] = "sales",
                                    ["table"] = "orders",
                                },
                                ["columnMappings"] = new List<object?>
                                {
                                    new Dictionary<string, object?>
                                    {
                                        ["formChildComponentCodeName"] = "customer_name",
                                        ["targetColumnName"] = "customer_name",
                                    },
                                },
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
            WorkflowTestComponentFactory.CreateTextInputComponent(),
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components);

        Assert.True(result.IsFailed);
        Assert.Contains("trigger component 'status_filter' is not a Form", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenSaveToTableMapsUnknownTargetColumn()
    {
        Models.DTOs.BuilderComponents.FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent(children: new[] { "text-1" });
        Models.DTOs.BuilderComponents.TextInputComponentDto textInputComponent = WorkflowTestComponentFactory.CreateTextInputComponent();
        Models.DTOs.BuilderComponents.DataWindowComponentDto dataWindowComponent = WorkflowTestComponentFactory.CreateDataWindowComponent();

        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_save_to_table_columns",
                    "parameter_form",
                    "onSubmit",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "save-1",
                            "SaveToTable",
                            new Dictionary<string, object?>
                            {
                                ["sourceFormComponentCodeName"] = "parameter_form",
                                ["targetTable"] = new Dictionary<string, object?>
                                {
                                    ["tableType"] = "unityCatalogTable",
                                    ["workspaceConnectionId"] = 1,
                                    ["catalog"] = "main",
                                    ["schema"] = "sales",
                                    ["table"] = "orders",
                                },
                                ["columnMappings"] = new List<object?>
                                {
                                    new Dictionary<string, object?>
                                    {
                                        ["formChildComponentCodeName"] = "customer_name",
                                        ["targetColumnName"] = "missing_column",
                                    },
                                },
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            formComponent,
            textInputComponent,
            dataWindowComponent,
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components);

        Assert.True(result.IsFailed);
        Assert.Contains("maps unknown target column 'missing_column'", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenBuildSqlPlaceholderMetadataDoesNotMatchTemplate()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_build_sql_validation",
                    "customer_name",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "build-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "unityCatalogTable",
                                ["sqlTemplate"] = "SELECT * FROM main.sales.orders WHERE customer_name = {customer_name}",
                                ["placeholders"] = new List<object?>
                                {
                                    new Dictionary<string, object?>
                                    {
                                        ["token"] = "region",
                                        ["componentCodeName"] = "customer_name",
                                        ["valueType"] = "string",
                                    },
                                },
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateTextInputComponent(),
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components);

        Assert.True(result.IsFailed);
        Assert.Contains("missing placeholder metadata for token 'customer_name'", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenBuildSqlReferencesUnknownPlaceholderComponent()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_build_sql_unknown_component",
                    "customer_name",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "build-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "unityCatalogTable",
                                ["sqlTemplate"] = "SELECT * FROM main.sales.orders WHERE customer_name = {customer_name}",
                                ["placeholders"] = new List<object?>
                                {
                                    new Dictionary<string, object?>
                                    {
                                        ["token"] = "customer_name",
                                        ["componentCodeName"] = "missing_component",
                                        ["valueType"] = "string",
                                    },
                                },
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateTextInputComponent(),
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components);

        Assert.True(result.IsFailed);
        Assert.Contains("references unknown placeholder component 'missing_component'", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenLakebaseBuildSqlMissingAppResource()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_lb_res",
                    "customer_name",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "build-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "lakebaseProvisionedDatabase",
                                ["sqlTemplate"] = "SELECT 1",
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateTextInputComponent(),
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components);

        Assert.True(result.IsFailed);
        Assert.Contains("requires a Lakebase app resource", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenLakebaseBuildSqlUnknownResourceInAppSettings()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_lb_uk",
                    "customer_name",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "build-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "lakebaseProvisionedDatabase",
                                ["sqlTemplate"] = "SELECT 1",
                                ["lakebaseAppResourceName"] = "missing",
                                ["lakebaseDatabaseName"] = "appdb",
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateTextInputComponent(),
        ];

        List<NormalizedAppResourceDto> resources =
        [
            new NormalizedAppResourceDto
            {
                Name = "other",
                Kind = DatabricksAppResourceKinds.Database,
                Database = new DatabaseResource { DatabaseName = "appdb" },
            },
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components, resources);

        Assert.True(result.IsFailed);
        Assert.Contains("unknown app resource 'missing'", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenRunSqlSourceActionTypeIsUnsupported()
    {
        RunSqlActionModel actionNode = new()
        {
            Id = "run-1",
            Statement = new RunSqlStatementRef
            {
                SourceActionType = (RunSqlStatementSourceActionType)99,
                NodeId = "build-1",
            },
        };

        Result result = ValidateTypedAction(
            actionNode,
            WorkflowTestComponentFactory.CreateSliderComponent());

        Assert.True(result.IsFailed);
        Assert.Contains("requires statement.sourceActionType to be BuildSql", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenSetBindingTargetDoesNotSupportWorkflowBindings()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_set_binding_target",
                    "status_filter",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "bind-1",
                            "SetBinding",
                            new Dictionary<string, object?>
                            {
                                ["source"] = new Dictionary<string, object?>
                                {
                                    ["sourceActionType"] = "RunSql",
                                    ["nodeId"] = "run-1",
                                    ["outputKey"] = "rows",
                                },
                                ["target"] = new Dictionary<string, object?>
                                {
                                    ["componentCodeName"] = "customer_name",
                                    ["bindingType"] = "unityCatalogTable",
                                },
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
            WorkflowTestComponentFactory.CreateTextInputComponent(),
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components);

        Assert.True(result.IsFailed);
        Assert.Contains("does not support workflow SQL-statement bindings", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenSetBindingBindingTypeDoesNotMatchTarget()
    {
        Models.DTOs.BuilderComponents.BarChartComponentDto chartComponent = WorkflowTestComponentFactory.CreateBarChartComponent();

        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_set_binding_binding_type",
                    "status_filter",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "bind-1",
                            "SetBinding",
                            new Dictionary<string, object?>
                            {
                                ["source"] = new Dictionary<string, object?>
                                {
                                    ["sourceActionType"] = "RunSql",
                                    ["nodeId"] = "run-1",
                                    ["outputKey"] = "rows",
                                },
                                ["target"] = new Dictionary<string, object?>
                                {
                                    ["componentCodeName"] = chartComponent.CodeName,
                                    ["bindingType"] = "unityCatalogTable",
                                },
                            }),
                    })));

        List<Models.DTOs.BuilderComponents.VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
            chartComponent,
        ];

        Result result = WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components);

        Assert.True(result.IsFailed);
        Assert.Contains("requires binding type 'ChartData'", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenSetBindingOutputKeyIsUnsupported()
    {
        SetBindingActionModel actionNode = new()
        {
            Id = "bind-1",
            Source = new SetBindingSourceRef
            {
                SourceActionType = SetBindingSourceActionType.RunSql,
                NodeId = "run-1",
                OutputKey = (SetBindingOutputKey)99,
            },
            Target = new SetBindingTargetRef
            {
                ComponentCodeName = "orders_grid",
                BindingType = SetBindingTargetType.UnityCatalogTable,
            },
        };

        Result result = ValidateTypedAction(
            actionNode,
            WorkflowTestComponentFactory.CreateSliderComponent(),
            WorkflowTestComponentFactory.CreateDataWindowComponent());

        Assert.True(result.IsFailed);
        Assert.Contains("requires source.outputKey to be rows", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenStartDatabricksJobReferenceIsIncomplete()
    {
        StartDatabricksJobActionModel actionNode = new()
        {
            Id = "start-job",
            Job = new DatabricksJobResourceRef
            {
                WorkspaceConnectionId = 0,
                JobId = string.Empty,
                JobName = string.Empty,
            },
        };

        Result result = ValidateTypedAction(
            actionNode,
            WorkflowTestComponentFactory.CreateButtonComponent());

        Assert.True(result.IsFailed);
        Assert.Contains("requires a workspace connection ID", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenTriggerToastSecondsDurationIsNotPositive()
    {
        TriggerToastActionModel actionNode = new()
        {
            Id = "toast-1",
            Body = "Saved",
            Duration = new ToastSecondsDurationModel
            {
                Value = 0,
            },
        };

        Result result = ValidateTypedAction(
            actionNode,
            WorkflowTestComponentFactory.CreateSliderComponent());

        Assert.True(result.IsFailed);
        Assert.Contains("positive numeric toast duration", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenCallCustomModuleFunctionNameIsNotPublicIdentifier()
    {
        CallCustomModuleActionModel actionNode = new()
        {
            Id = "custom-1",
            FunctionName = "__private_fn",
        };

        Result result = ValidateTypedAction(
            actionNode,
            WorkflowTestComponentFactory.CreateButtonComponent());

        Assert.True(result.IsFailed);
        Assert.Contains("functionName", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Validate_SucceedsWhenCallCustomModuleFunctionNameIsValid()
    {
        CallCustomModuleActionModel actionNode = new()
        {
            Id = "custom-1",
            FunctionName = "send_email",
        };

        Result result = ValidateTypedAction(
            actionNode,
            WorkflowTestComponentFactory.CreateButtonComponent());

        Assert.True(result.IsSuccess);
    }

    private static Result ValidateTypedAction(
        WorkflowActionNodeModel actionNode,
        params Models.DTOs.BuilderComponents.VdabComponentDto[] components)
    {
        WorkflowDefinitionModel workflowDefinition = new()
        {
            Workflows = new List<WorkflowModel>
            {
                new()
                {
                    CodeName = "wf_test",
                    Trigger = new WorkflowTriggerModel
                    {
                        ComponentCodeName = components[0].CodeName!,
                        EventKey = components[0].SupportedEvents?.FirstOrDefault() ?? "onChange",
                    },
                    Nodes = new List<WorkflowActionNodeModel> { actionNode },
                    Edges = new List<WorkflowEdgeModel>(),
                },
            },
        };

        return WorkflowTestTemplateServiceFactory.CreateWorkflowActionValidator().Validate(workflowDefinition, components.ToList());
    }

    private static WorkflowDefinitionModel ParseDefinition(WorkflowDefinitionDto workflowDefinition)
    {
        Result<WorkflowDefinitionModel> parseResult = WorkflowDefinitionParser.Parse(workflowDefinition);

        Assert.True(parseResult.IsSuccess);
        return parseResult.Value;
    }
}