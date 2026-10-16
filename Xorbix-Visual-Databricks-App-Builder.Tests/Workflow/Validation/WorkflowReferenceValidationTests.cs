using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Validation;

public class WorkflowReferenceValidationTests
{
    [Fact]
    public void Validate_FailsWhenRunSqlReferencesMissingBuildSqlNode()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_missing_build_sql",
                    "status_filter",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "run-1",
                            "RunSql",
                            new Dictionary<string, object?>
                            {
                                ["statement"] = new Dictionary<string, object?>
                                {
                                    ["sourceActionType"] = "BuildSql",
                                    ["nodeId"] = "build-missing",
                                },
                            }),
                    })));

        Result result = WorkflowReferenceValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("references missing BuildSql source node 'build-missing'", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenRunSqlSourceNodeIsWrongType()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_wrong_build_sql_type",
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
                        WorkflowTestDefinitionFactory.CreateNode(
                            "run-1",
                            "RunSql",
                            new Dictionary<string, object?>
                            {
                                ["statement"] = new Dictionary<string, object?>
                                {
                                    ["sourceActionType"] = "BuildSql",
                                    ["nodeId"] = "toast-1",
                                },
                            }),
                    })));

        Result result = WorkflowReferenceValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("requires source node 'toast-1' to be a BuildSql action", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenRunSqlDoesNotReferencePriorBuildSqlNode()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_out_of_order_run_sql",
                    "status_filter",
                    "onChange",
                    new[]
                    {
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
                            }),
                        WorkflowTestDefinitionFactory.CreateNode(
                            "build-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "unityCatalogTable",
                                ["sqlTemplate"] = "SELECT 1",
                            }),
                    })));

        Result result = WorkflowReferenceValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("does not execute before it", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_AllowsRunSqlReferenceToEarlierNodeByOrderWithoutEdgePath()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_prior_order_run_sql",
                    "status_filter",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "build-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "unityCatalogTable",
                                ["sqlTemplate"] = "SELECT 1",
                            }),
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
                            }),
                    })));

        Result result = WorkflowReferenceValidator.Validate(workflowDefinition);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public void Validate_FailsWhenSetBindingReferencesMissingRunSqlNode()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_missing_run_sql",
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
                                    ["nodeId"] = "run-missing",
                                    ["outputKey"] = "rows",
                                },
                                ["target"] = new Dictionary<string, object?>
                                {
                                    ["componentCodeName"] = "orders_grid",
                                    ["bindingType"] = "unityCatalogTable",
                                },
                            }),
                    })));

        Result result = WorkflowReferenceValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("references missing RunSql source node 'run-missing'", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsWhenSetBindingSourceNodeIsWrongType()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_wrong_run_sql_type",
                    "status_filter",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "build-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "unityCatalogTable",
                                ["sqlTemplate"] = "SELECT 1",
                            }),
                        WorkflowTestDefinitionFactory.CreateNode(
                            "bind-1",
                            "SetBinding",
                            new Dictionary<string, object?>
                            {
                                ["source"] = new Dictionary<string, object?>
                                {
                                    ["sourceActionType"] = "RunSql",
                                    ["nodeId"] = "build-1",
                                    ["outputKey"] = "rows",
                                },
                                ["target"] = new Dictionary<string, object?>
                                {
                                    ["componentCodeName"] = "orders_grid",
                                    ["bindingType"] = "unityCatalogTable",
                                },
                            }),
                    })));

        Result result = WorkflowReferenceValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("requires source node 'build-1' to be a RunSql action", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_AllowsSetBindingReferenceToEarlierRunSqlNodeByOrderWithoutEdgePath()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_prior_order_set_binding",
                    "status_filter",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "build-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "unityCatalogTable",
                                ["sqlTemplate"] = "SELECT 1",
                            }),
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
                            }),
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
                            }),
                    })));

        Result result = WorkflowReferenceValidator.Validate(workflowDefinition);

        Assert.True(result.IsSuccess);
    }

    private static WorkflowDefinitionModel ParseDefinition(Models.DTOs.Workflow.WorkflowDefinitionDto workflowDefinition)
    {
        Result<WorkflowDefinitionModel> parseResult = WorkflowDefinitionParser.Parse(workflowDefinition);

        Assert.True(parseResult.IsSuccess);
        return parseResult.Value;
    }
}