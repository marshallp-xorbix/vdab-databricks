using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Generators;

public class RunSqlActionGeneratorTests
{
    [Fact]
    public void AppendRuntimeExecution_UsesUnityCatalogQueryHelper()
    {
        RunSqlActionGenerator generator = new();
        BuildSqlActionModel buildSqlNode = CreateBuildSqlNode("build-1", WorkflowSqlSourceKind.UnityCatalogTable);
        RunSqlActionModel runSqlNode = CreateRunSqlNode("run-1", "build-1");

        string runtime = GenerateRuntime(generator, buildSqlNode, runSqlNode);

        Assert.Contains("statement = _resolve_workflow_path('build-1.output.sql', workflow_state)", runtime);
        Assert.Contains("rows = sql_query_df(str(statement))", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_UsesLakebaseQueryHelper()
    {
        RunSqlActionGenerator generator = new();
        BuildSqlActionModel buildSqlNode = CreateBuildSqlNode(
            "build-1",
            WorkflowSqlSourceKind.LakebaseProvisionedDatabase,
            lakebaseAppResourceName: "my_lb",
            lakebaseDatabaseName: "appdb");
        RunSqlActionModel runSqlNode = CreateRunSqlNode("run-1", "build-1");

        string runtime = GenerateRuntime(generator, buildSqlNode, runSqlNode);

        string hostEnv = LakebaseWorkflowEnvNaming.ProvisionedHostEnvironmentVariableName("my_lb");
        string dbEnv = LakebaseWorkflowEnvNaming.DatabaseEnvironmentVariableName("my_lb");
        Assert.Contains("_vdab_lakebase_run_for_workflow('lakebaseProvisionedDatabase', ", runtime);
        Assert.Contains($"'{hostEnv}'", runtime);
        Assert.Contains($"'{dbEnv}'", runtime);
        Assert.Contains("isinstance(_vdab_run_sql_result, pd.DataFrame)", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_UsesLakebaseQueryHelperForAutoscalingBuildSql()
    {
        RunSqlActionGenerator generator = new();
        BuildSqlActionModel buildSqlNode = CreateBuildSqlNode(
            "build-1",
            WorkflowSqlSourceKind.LakebaseAutoscaling,
            lakebaseAppResourceName: "my_lb",
            lakebaseDatabaseName: "appdb");
        RunSqlActionModel runSqlNode = CreateRunSqlNode("run-1", "build-1");

        string runtime = GenerateRuntime(generator, buildSqlNode, runSqlNode);

        string epEnv = LakebaseWorkflowEnvNaming.AutoscalingEndpointEnvironmentVariableName("my_lb");
        string dbEnv = LakebaseWorkflowEnvNaming.DatabaseEnvironmentVariableName("my_lb");
        Assert.Contains("_vdab_lakebase_run_for_workflow('lakebaseAutoscaling', ", runtime);
        Assert.Contains($"'{epEnv}'", runtime);
        Assert.Contains($"'{dbEnv}'", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_ReportsErrorWhenSourceBuildSqlNodeIsMissing()
    {
        RunSqlActionGenerator generator = new();
        RunSqlActionModel runSqlNode = CreateRunSqlNode("run-1", "build-missing");
        StringBuilder sb = new();

        generator.AppendRuntimeExecution(
            sb,
            runSqlNode,
            WorkflowTestTemplateServiceFactory.CreateGenerationContext(new WorkflowActionNodeModel[] { runSqlNode }),
            triggerComponent: null,
            components: new List<Models.DTOs.BuilderComponents.VdabComponentDto>(),
            indentation: "    ");

        Assert.Contains("RunSql requires a resolved BuildSql source node.", sb.ToString());
    }

    private static BuildSqlActionModel CreateBuildSqlNode(
        string id,
        WorkflowSqlSourceKind sqlSourceKind,
        string? lakebaseAppResourceName = null,
        string? lakebaseDatabaseName = null)
    {
        return new BuildSqlActionModel
        {
            Id = id,
            SqlSourceKind = sqlSourceKind,
            SqlTemplate = "SELECT 1",
            Placeholders = new List<Models.Workflow.SharedReferences.BuildSqlPlaceholderReference>(),
            LakebaseAppResourceName = lakebaseAppResourceName,
            LakebaseDatabaseName = lakebaseDatabaseName,
        };
    }

    private static RunSqlActionModel CreateRunSqlNode(string id, string sourceNodeId)
    {
        return new RunSqlActionModel
        {
            Id = id,
            Statement = new RunSqlStatementRef
            {
                SourceActionType = RunSqlStatementSourceActionType.BuildSql,
                NodeId = sourceNodeId,
            },
        };
    }

    private static string GenerateRuntime(RunSqlActionGenerator generator, params WorkflowActionNodeModel[] nodes)
    {
        StringBuilder sb = new();
        RunSqlActionModel runSqlNode = Assert.IsType<RunSqlActionModel>(nodes.Last());

        generator.AppendRuntimeExecution(
            sb,
            runSqlNode,
            WorkflowTestTemplateServiceFactory.CreateGenerationContext(nodes),
            triggerComponent: null,
            components: new List<Models.DTOs.BuilderComponents.VdabComponentDto>(),
            indentation: "    ");

        return sb.ToString();
    }
}