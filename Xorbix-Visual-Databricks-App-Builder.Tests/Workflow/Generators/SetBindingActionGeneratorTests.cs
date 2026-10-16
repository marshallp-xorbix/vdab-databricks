using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Generators;

public class SetBindingActionGeneratorTests
{
    [Fact]
    public void AppendRuntimeExecution_BindsRowsToChartDataTarget()
    {
        SetBindingActionGenerator generator = new();
        RunSqlActionModel runSqlNode = CreateRunSqlNode();
        SetBindingActionModel actionNode = new()
        {
            Id = "bind-1",
            Source = new SetBindingSourceRef
            {
                SourceActionType = SetBindingSourceActionType.RunSql,
                NodeId = "run-1",
                OutputKey = SetBindingOutputKey.Rows,
            },
            Target = new SetBindingTargetRef
            {
                ComponentCodeName = "orders_chart",
                BindingType = SetBindingTargetType.ChartData,
            },
        };

        string runtime = GenerateRuntime(
            generator,
            new WorkflowActionNodeModel[] { runSqlNode, actionNode },
            WorkflowTestComponentFactory.CreateBarChartComponent());

        Assert.Contains("binding_value = _resolve_workflow_path('run-1.output.rows', workflow_state)", runtime);
        Assert.Contains("binding_overrides['orders_chart:chartData'] = binding_value", runtime);
        Assert.Contains("Manually rerun to see updated data.", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_BindsRowsToTableTarget()
    {
        SetBindingActionGenerator generator = new();
        RunSqlActionModel runSqlNode = CreateRunSqlNode();
        SetBindingActionModel actionNode = new()
        {
            Id = "bind-1",
            Source = new SetBindingSourceRef
            {
                SourceActionType = SetBindingSourceActionType.RunSql,
                NodeId = "run-1",
                OutputKey = SetBindingOutputKey.Rows,
            },
            Target = new SetBindingTargetRef
            {
                ComponentCodeName = "orders_grid",
                BindingType = SetBindingTargetType.UnityCatalogTable,
            },
        };

        string runtime = GenerateRuntime(
            generator,
            new WorkflowActionNodeModel[] { runSqlNode, actionNode },
            WorkflowTestComponentFactory.CreateDataWindowComponent());

        Assert.Contains("binding_overrides['orders_grid:unityCatalogTable'] = binding_value", runtime);
        Assert.Contains("workflow_state['bind-1'] = {'status': 'success', 'output': {'applied': binding_value is not None}, 'error': None}", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_ReportsErrorWhenSourceRunSqlNodeIsMissing()
    {
        SetBindingActionGenerator generator = new();
        SetBindingActionModel actionNode = new()
        {
            Id = "bind-1",
            Source = new SetBindingSourceRef
            {
                SourceActionType = SetBindingSourceActionType.RunSql,
                NodeId = "run-missing",
                OutputKey = SetBindingOutputKey.Rows,
            },
            Target = new SetBindingTargetRef
            {
                ComponentCodeName = "orders_grid",
                BindingType = SetBindingTargetType.UnityCatalogTable,
            },
        };
        StringBuilder sb = new();

        generator.AppendRuntimeExecution(
            sb,
            actionNode,
            WorkflowTestTemplateServiceFactory.CreateGenerationContext(new WorkflowActionNodeModel[] { actionNode }),
            triggerComponent: null,
            components: new List<VdabComponentDto>(),
            indentation: "    ");

        Assert.Contains("SetBinding requires a resolved RunSql source node.", sb.ToString());
    }

    private static RunSqlActionModel CreateRunSqlNode()
    {
        return new RunSqlActionModel
        {
            Id = "run-1",
            Statement = new RunSqlStatementRef
            {
                SourceActionType = RunSqlStatementSourceActionType.BuildSql,
                NodeId = "build-1",
            },
        };
    }

    private static string GenerateRuntime(
        SetBindingActionGenerator generator,
        IEnumerable<WorkflowActionNodeModel> nodes,
        params VdabComponentDto[] components)
    {
        List<WorkflowActionNodeModel> nodeList = nodes.ToList();
        SetBindingActionModel actionNode = Assert.IsType<SetBindingActionModel>(nodeList.Last());
        StringBuilder sb = new();

        generator.AppendRuntimeExecution(
            sb,
            actionNode,
            WorkflowTestTemplateServiceFactory.CreateGenerationContext(nodeList),
            triggerComponent: null,
            components: components.ToList(),
            indentation: "    ");

        return sb.ToString();
    }
}