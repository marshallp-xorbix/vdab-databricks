using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Parsing;

public class WorkflowDefinitionParserTests
{
    [Fact]
    public void Parse_ParsesTriggerToastIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "toast-1",
                "TriggerToast",
                new Dictionary<string, object?>
                {
                    ["body"] = "Saved",
                    ["icon"] = ":material/check:",
                    ["duration"] = new Dictionary<string, object?>
                    {
                        ["kind"] = "preset",
                        ["value"] = "long",
                    },
                }));

        TriggerToastActionModel actionNode = AssertTypedNode<TriggerToastActionModel>(workflowDefinition);

        Assert.Equal("Saved", actionNode.Body);
        Assert.Equal(":material/check:", actionNode.Icon);
        ToastPresetDurationModel duration = Assert.IsType<ToastPresetDurationModel>(actionNode.Duration);
        Assert.Equal(ToastPresetDuration.Long, duration.Value);
    }

    [Fact]
    public void Parse_ParsesShowModalIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "show-modal",
                "ShowModal",
                new Dictionary<string, object?>
                {
                    ["modalCodeName"] = "claims_modal",
                }));

        ShowModalActionModel actionNode = AssertTypedNode<ShowModalActionModel>(workflowDefinition);

        Assert.Equal("claims_modal", actionNode.ModalCodeName);
    }

    [Fact]
    public void Parse_ParsesCallCustomModuleIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "custom-1",
                "CallCustomModule",
                new Dictionary<string, object?>
                {
                    ["functionName"] = "send_email",
                }));

        CallCustomModuleActionModel actionNode = AssertTypedNode<CallCustomModuleActionModel>(workflowDefinition);

        Assert.Equal("send_email", actionNode.FunctionName);
    }

    [Fact]
    public void Parse_ParsesSaveToTableIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
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
                    ["excludedColumns"] = new List<object?>
                    {
                        new Dictionary<string, object?>
                        {
                            ["columnName"] = "created_at",
                            ["reason"] = "systemManaged",
                        },
                    },
                    ["columnMappings"] = new List<object?>
                    {
                        new Dictionary<string, object?>
                        {
                            ["formChildComponentCodeName"] = "customer_name",
                            ["targetColumnName"] = "customer_name",
                        },
                    },
                }));

        SaveToTableActionModel actionNode = AssertTypedNode<SaveToTableActionModel>(workflowDefinition);

        Assert.Equal("parameter_form", actionNode.SourceFormComponentCodeName);
        UnityCatalogTableRef targetTable = Assert.IsType<UnityCatalogTableRef>(actionNode.TargetTable);
        Assert.Equal("main", targetTable.Catalog);
        Assert.Single(actionNode.ExcludedColumns);
        Assert.Equal(SaveToTableColumnOverrideReason.SystemManaged, actionNode.ExcludedColumns[0].Reason);
        Assert.Single(actionNode.ColumnMappings);
        Assert.Equal("customer_name", actionNode.ColumnMappings[0].TargetColumnName);
    }

    [Fact]
    public void Parse_ParsesSaveToTableLakebaseAutoscalingIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "save-autoscaling",
                "SaveToTable",
                new Dictionary<string, object?>
                {
                    ["sourceFormComponentCodeName"] = "parameter_form",
                    ["targetTable"] = new Dictionary<string, object?>
                    {
                        ["tableType"] = "lakebaseAutoscaling",
                        ["workspaceConnectionId"] = 1,
                        ["projectId"] = "proj-1",
                        ["branchId"] = "branch-1",
                        ["endpointId"] = "ep-1",
                        ["database"] = "appdb",
                        ["catalog"] = "appdb",
                        ["schema"] = "public",
                        ["table"] = "t1",
                    },
                    ["columnMappings"] = new List<object?>
                    {
                        new Dictionary<string, object?>
                        {
                            ["formChildComponentCodeName"] = "customer_name",
                            ["targetColumnName"] = "customer_name",
                        },
                    },
                }));

        SaveToTableActionModel actionNode = AssertTypedNode<SaveToTableActionModel>(workflowDefinition);

        LakebaseAutoscalingTableRef targetTable = Assert.IsType<LakebaseAutoscalingTableRef>(actionNode.TargetTable);
        Assert.Equal("proj-1", targetTable.ProjectId);
        Assert.Equal("branch-1", targetTable.BranchId);
        Assert.Equal("ep-1", targetTable.EndpointId);
        Assert.Equal("appdb", targetTable.Database);
        Assert.Equal("public", targetTable.Schema);
        Assert.Equal("t1", targetTable.Table);
    }

    [Fact]
    public void Parse_ParsesBuildSqlIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
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
                            ["componentCodeName"] = "customer_name",
                            ["valueType"] = "string",
                            ["formatHint"] = "sqlStringLiteral",
                        },
                    },
                }));

        BuildSqlActionModel actionNode = AssertTypedNode<BuildSqlActionModel>(workflowDefinition);

        Assert.Equal(WorkflowSqlSourceKind.UnityCatalogTable, actionNode.SqlSourceKind);
        Assert.Single(actionNode.Placeholders);
        Assert.Equal("customer_name", actionNode.Placeholders[0].Token);
        Assert.Equal(WorkflowValueType.String, actionNode.Placeholders[0].ValueType);
        Assert.Equal(BuildSqlFormatHint.SqlStringLiteral, actionNode.Placeholders[0].FormatHint);
    }

    [Fact]
    public void Parse_ParsesBuildSqlLakebaseAutoscalingIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "build-autoscaling",
                "BuildSql",
                new Dictionary<string, object?>
                {
                    ["sqlSourceKind"] = "lakebaseAutoscaling",
                    ["sqlTemplate"] = "SELECT 1",
                }));

        BuildSqlActionModel actionNode = AssertTypedNode<BuildSqlActionModel>(workflowDefinition);

        Assert.Equal(WorkflowSqlSourceKind.LakebaseAutoscaling, actionNode.SqlSourceKind);
    }

    [Fact]
    public void Parse_ParsesBuildSqlLakebaseResourceFields()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "build-res",
                "BuildSql",
                new Dictionary<string, object?>
                {
                    ["sqlSourceKind"] = "lakebaseProvisionedDatabase",
                    ["sqlTemplate"] = "SELECT 1",
                    ["lakebaseAppResourceName"] = "my_db",
                    ["lakebaseDatabaseName"] = "analytics",
                }));

        BuildSqlActionModel actionNode = AssertTypedNode<BuildSqlActionModel>(workflowDefinition);

        Assert.Equal("my_db", actionNode.LakebaseAppResourceName);
        Assert.Equal("analytics", actionNode.LakebaseDatabaseName);
    }

    [Fact]
    public void Parse_ParsesRunSqlIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "run-1",
                "RunSql",
                new Dictionary<string, object?>
                {
                    ["statement"] = new Dictionary<string, object?>
                    {
                        ["sourceActionType"] = "BuildSql",
                        ["nodeId"] = "build-1",
                    },
                }));

        RunSqlActionModel actionNode = AssertTypedNode<RunSqlActionModel>(workflowDefinition);

        Assert.Equal(RunSqlStatementSourceActionType.BuildSql, actionNode.Statement.SourceActionType);
        Assert.Equal("build-1", actionNode.Statement.NodeId);
    }

    [Fact]
    public void Parse_ParsesSetBindingIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
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
                        ["componentCodeName"] = "orders_grid",
                        ["bindingType"] = "unityCatalogTable",
                    },
                }));

        SetBindingActionModel actionNode = AssertTypedNode<SetBindingActionModel>(workflowDefinition);

        Assert.Equal(SetBindingSourceActionType.RunSql, actionNode.Source.SourceActionType);
        Assert.Equal(SetBindingOutputKey.Rows, actionNode.Source.OutputKey);
        Assert.Equal("orders_grid", actionNode.Target.ComponentCodeName);
        Assert.Equal(SetBindingTargetType.UnityCatalogTable, actionNode.Target.BindingType);
    }

    [Fact]
    public void Parse_ParsesStartDatabricksJobIntoTypedModel()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "start-job",
                "StartDatabricksJob",
                new Dictionary<string, object?>
                {
                    ["job"] = new Dictionary<string, object?>
                    {
                        ["workspaceConnectionId"] = 42,
                        ["jobId"] = "123456",
                        ["jobName"] = "Sales Sync",
                    },
                }));

        StartDatabricksJobActionModel actionNode = AssertTypedNode<StartDatabricksJobActionModel>(workflowDefinition);

        Assert.Equal(42, actionNode.Job.WorkspaceConnectionId);
        Assert.Equal("123456", actionNode.Job.JobId);
        Assert.Equal("Sales Sync", actionNode.Job.JobName);
    }

    [Fact]
    public void Parse_FailsForUnsupportedActionType()
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(
            WorkflowTestDefinitionFactory.CreateNode(
                "node-1",
                "UnknownAction"));

        Result<WorkflowDefinitionModel> result = WorkflowDefinitionParser.Parse(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("Unsupported workflow action type", result.Errors[0].Message);
    }

    [Theory]
    [MemberData(nameof(GetInvalidActionParamCases))]
    public void Parse_FailsWhenActionParametersUseUnsupportedShape(WorkflowNodeDto node, string expectedMessage)
    {
        WorkflowDefinitionDto workflowDefinition = CreateSingleNodeWorkflow(node);

        Result<WorkflowDefinitionModel> result = WorkflowDefinitionParser.Parse(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains(expectedMessage, result.Errors[0].Message);
    }

    [Fact]
    public void Parse_FailsWhenRouteIsUnsupported()
    {
        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_invalid_route",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "toast-1",
                        "TriggerToast",
                        new Dictionary<string, object?>
                        {
                            ["body"] = "Saved",
                            ["duration"] = new Dictionary<string, object?>
                            {
                                ["kind"] = "preset",
                                ["value"] = "short",
                            },
                        }),
                },
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateEdge("toast-1", "toast-1", "later"),
                }));

        Result<WorkflowDefinitionModel> result = WorkflowDefinitionParser.Parse(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("unsupported route 'later'", result.Errors[0].Message);
    }

    public static IEnumerable<object[]> GetInvalidActionParamCases()
    {
        yield return new object[]
        {
            WorkflowTestDefinitionFactory.CreateNode(
                "toast-invalid",
                "TriggerToast",
                new Dictionary<string, object?>
                {
                    ["body"] = "Saved",
                    ["duration"] = "long",
                }),
            "invalid 'duration'",
        };

        yield return new object[]
        {
            WorkflowTestDefinitionFactory.CreateNode(
                "modal-invalid",
                "ShowModal",
                new Dictionary<string, object?>
                {
                    ["modalCodeName"] = 123,
                }),
            "invalid 'modalCodeName'",
        };

        yield return new object[]
        {
            WorkflowTestDefinitionFactory.CreateNode(
                "save-invalid",
                "SaveToTable",
                new Dictionary<string, object?>
                {
                    ["sourceFormComponentCodeName"] = "parameter_form",
                    ["targetTable"] = 12,
                }),
            "invalid 'targetTable'",
        };

        yield return new object[]
        {
            WorkflowTestDefinitionFactory.CreateNode(
                "build-invalid",
                "BuildSql",
                new Dictionary<string, object?>
                {
                    ["sqlSourceKind"] = "unityCatalogTable",
                    ["sqlTemplate"] = "SELECT 1",
                    ["placeholders"] = "customer_name",
                }),
            "invalid 'placeholders'",
        };

        yield return new object[]
        {
            WorkflowTestDefinitionFactory.CreateNode(
                "run-invalid",
                "RunSql",
                new Dictionary<string, object?>
                {
                    ["statement"] = new Dictionary<string, object?>
                    {
                        ["sourceActionType"] = "TriggerToast",
                        ["nodeId"] = "toast-1",
                    },
                }),
            "requires statement.sourceActionType to be 'BuildSql'",
        };

        yield return new object[]
        {
            WorkflowTestDefinitionFactory.CreateNode(
                "bind-invalid",
                "SetBinding",
                new Dictionary<string, object?>
                {
                    ["source"] = new Dictionary<string, object?>
                    {
                        ["sourceActionType"] = "RunSql",
                        ["nodeId"] = "run-1",
                        ["outputKey"] = "data",
                    },
                    ["target"] = new Dictionary<string, object?>
                    {
                        ["componentCodeName"] = "orders_grid",
                        ["bindingType"] = "unityCatalogTable",
                    },
                }),
            "requires source.outputKey to be 'rows'",
        };

        yield return new object[]
        {
            WorkflowTestDefinitionFactory.CreateNode(
                "job-invalid",
                "StartDatabricksJob",
                new Dictionary<string, object?>
                {
                    ["job"] = new Dictionary<string, object?>
                    {
                        ["workspaceConnectionId"] = 0,
                        ["jobId"] = "123456",
                        ["jobName"] = "Sales Sync",
                    },
                }),
            "positive integer",
        };
    }

    private static WorkflowDefinitionDto CreateSingleNodeWorkflow(WorkflowNodeDto node)
    {
        return WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_test",
                "status_filter",
                "onChange",
                new[] { node }));
    }

    private static TActionNode AssertTypedNode<TActionNode>(WorkflowDefinitionDto workflowDefinition)
        where TActionNode : WorkflowActionNodeModel
    {
        Result<WorkflowDefinitionModel> result = WorkflowDefinitionParser.Parse(workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Workflows);
        Assert.Single(result.Value.Workflows[0].Nodes);
        return Assert.IsType<TActionNode>(result.Value.Workflows[0].Nodes[0]);
    }
}