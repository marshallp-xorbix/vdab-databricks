using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class AiBuilderOperationValidatorTests
{
    [Fact]
    public void Validate_ReturnsReason_WhenWorkflowActionsAreDisconnected()
    {
        AiBuilderRequest request = CreateRequest();
        WorkflowDto workflow = CreateWorkflow(
            [
                CreateNode("toast", "TriggerToast", new { body = "Saved" }),
                CreateNode("job", "StartDatabricksJob", new { job = new { jobId = "1", jobName = "Refresh" } }),
            ],
            []);

        AiBuilderOutcomeReason? reason = AiBuilderOperationValidator.Validate(
            request,
            [new CanvasOperationDto { Op = "addWorkflow", Workflow = workflow }]);

        Assert.NotNull(reason);
        Assert.Equal(AiBuilderReasonCode.OperationValidationFailed, reason.Code);
        Assert.Contains("multiple actions but no edges", reason.Details[0]);
    }

    [Fact]
    public void Validate_ReturnsNull_ForConnectedSqlBindingWorkflow()
    {
        AiBuilderRequest request = CreateRequest();
        WorkflowDto workflow = CreateWorkflow(
            [
                CreateNode("build", "BuildSql", new { sqlSourceKind = "unityCatalogTable", sqlTemplate = "SELECT * FROM main.sales.orders" }),
                CreateNode("run", "RunSql", new { statement = new { sourceActionType = "BuildSql", nodeId = "build" } }),
                CreateNode("bind", "SetBinding", new
                {
                    source = new { sourceActionType = "RunSql", nodeId = "run", outputKey = "rows" },
                    target = new { componentCodeName = "ordersGrid", bindingType = "unityCatalogTable" },
                }),
            ],
            [
                new WorkflowEdgeDto { FromNodeId = "build", ToNodeId = "run", Route = "onSuccess" },
                new WorkflowEdgeDto { FromNodeId = "run", ToNodeId = "bind", Route = "onSuccess" },
            ]);

        AiBuilderOutcomeReason? reason = AiBuilderOperationValidator.Validate(
            request,
            [new CanvasOperationDto { Op = "addWorkflow", Workflow = workflow }]);

        Assert.Null(reason);
    }

    [Fact]
    public void Validate_ReturnsNull_WhenCustomModuleCodeIsUpdatedBeforeWorkflowUsesIt()
    {
        AiBuilderRequest request = CreateRequest();
        WorkflowDto workflow = CreateWorkflow(
            [
                CreateNode("custom", "CallCustomModule", new { functionName = "validate_order" }),
            ],
            []);

        AiBuilderOutcomeReason? reason = AiBuilderOperationValidator.Validate(
            request,
            [
                new CanvasOperationDto
                {
                    Op = "updateCustomModulesCode",
                    CustomModulesCode = """
                        def validate_order(ctx):
                            ctx.set_label("ordersGrid", "Validated")
                            return {"ok": True}
                        """,
                },
                new CanvasOperationDto { Op = "addWorkflow", Workflow = workflow },
            ]);

        Assert.Null(reason);
    }

    [Fact]
    public void Validate_ReturnsReason_WhenCustomModuleFunctionIsMissing()
    {
        AiBuilderRequest request = CreateRequest();
        WorkflowDto workflow = CreateWorkflow(
            [
                CreateNode("custom", "CallCustomModule", new { functionName = "missing_function" }),
            ],
            []);

        AiBuilderOutcomeReason? reason = AiBuilderOperationValidator.Validate(
            request,
            [new CanvasOperationDto { Op = "addWorkflow", Workflow = workflow }]);

        Assert.NotNull(reason);
        Assert.Contains("missing_function", reason.Details[0]);
    }

    [Fact]
    public void Validate_ReturnsReason_WhenDeleteWorkflowTargetIsUnknown()
    {
        AiBuilderRequest request = CreateRequest();

        AiBuilderOutcomeReason? reason = AiBuilderOperationValidator.Validate(
            request,
            [new CanvasOperationDto { Op = "deleteWorkflow", ComponentId = "missingWorkflow" }]);

        Assert.NotNull(reason);
        Assert.Contains("missingWorkflow", reason.Details[0]);
    }

    [Fact]
    public void Validate_ReturnsNull_ForPrebuiltModuleWorkflowAction()
    {
        AiBuilderRequest request = CreateRequest();
        WorkflowDto workflow = CreateWorkflow(
            [
                CreateNode("prebuilt", "CallPrebuiltModule", new
                {
                    functionName = "change_text",
                    namedArguments = new Dictionary<string, string>
                    {
                        ["component"] = "ordersGrid",
                        ["new_label"] = "Loaded",
                    },
                }),
            ],
            []);

        AiBuilderOutcomeReason? reason = AiBuilderOperationValidator.Validate(
            request,
            [new CanvasOperationDto { Op = "addWorkflow", Workflow = workflow }]);

        Assert.Null(reason);
    }

    private static AiBuilderRequest CreateRequest()
    {
        return new AiBuilderRequest
        {
            AppId = 1,
            Prompt = "Build a workflow",
            CurrentComponents =
            [
                new CanvasComponentSummaryDto { Id = "button-1", Type = "Button", CodeName = "refreshButton" },
                new CanvasComponentSummaryDto { Id = "grid-1", Type = "DataWindow", CodeName = "ordersGrid" },
            ],
        };
    }

    private static WorkflowDto CreateWorkflow(List<WorkflowActionNodeDto> nodes, List<WorkflowEdgeDto> edges)
    {
        return new WorkflowDto
        {
            CodeName = "refreshOrders",
            Trigger = new WorkflowTriggerDto
            {
                ComponentCodeName = "refreshButton",
                EventKey = "onClick",
            },
            Nodes = nodes,
            Edges = edges,
        };
    }

    private static WorkflowActionNodeDto CreateNode(string id, string actionType, object parameters)
    {
        return new WorkflowActionNodeDto
        {
            Id = id,
            ActionType = actionType,
            SchemaVersion = 1,
            Params = parameters,
        };
    }
}
