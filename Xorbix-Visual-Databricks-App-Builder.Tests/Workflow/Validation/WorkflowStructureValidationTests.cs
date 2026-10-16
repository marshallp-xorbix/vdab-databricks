using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Validation;

public class WorkflowStructureValidationTests
{
    [Fact]
    public void Validate_FailsForDuplicateWorkflowCodeNames()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow("wf_duplicate", "status_filter", "onChange"),
                WorkflowTestDefinitionFactory.CreateWorkflow("wf_duplicate", "open_claims_button", "onClick")));

        Result result = WorkflowStructureValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("code name 'wf_duplicate' is duplicated", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsForDuplicateTriggerHandlers()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow("wf_one", "open_claims_button", "onClick"),
                WorkflowTestDefinitionFactory.CreateWorkflow("wf_two", "open_claims_button", "onClick")));

        Result result = WorkflowStructureValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("Only one workflow can use a given trigger", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsForDuplicateNodeIds()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_duplicate_nodes",
                    "status_filter",
                    "onChange",
                    new[]
                    {
                        WorkflowTestDefinitionFactory.CreateNode(
                            "node-1",
                            "BuildSql",
                            new Dictionary<string, object?>
                            {
                                ["sqlSourceKind"] = "unityCatalogTable",
                                ["sqlTemplate"] = "SELECT 1",
                            }),
                        WorkflowTestDefinitionFactory.CreateNode(
                            "node-1",
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
                    })));

        Result result = WorkflowStructureValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("contains duplicate node IDs", result.Errors[0].Message);
    }

    [Fact]
    public void Validate_FailsForEdgesThatReferenceMissingNodes()
    {
        WorkflowDefinitionModel workflowDefinition = ParseDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
                WorkflowTestDefinitionFactory.CreateWorkflow(
                    "wf_missing_edge_node",
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
                        WorkflowTestDefinitionFactory.CreateEdge("toast-1", "missing-node", "always"),
                    })));

        Result result = WorkflowStructureValidator.Validate(workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("edge that references a missing node", result.Errors[0].Message);
    }

    private static WorkflowDefinitionModel ParseDefinition(Models.DTOs.Workflow.WorkflowDefinitionDto workflowDefinition)
    {
        Result<WorkflowDefinitionModel> parseResult = WorkflowDefinitionParser.Parse(workflowDefinition);

        Assert.True(parseResult.IsSuccess);
        return parseResult.Value;
    }
}