using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;

public class RunSqlActionGenerator : WorkflowActionGeneratorBase<RunSqlActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.RunSql;

    public override void AppendRuntimeExecution(StringBuilder sb, RunSqlActionModel actionNode, WorkflowActionGenerationContext generationContext, VdabComponentDto? triggerComponent, List<VdabComponentDto> components, string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);
        if (!generationContext.NodesById.TryGetValue(actionNode.Statement.NodeId, out WorkflowActionNodeModel? sourceNode) ||
            sourceNode is not BuildSqlActionModel buildSqlNode)
        {
            sb.AppendLine($"{indentation}workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': 'RunSql requires a resolved BuildSql source node.'}}");
            return;
        }

        string statementPath = $"{actionNode.Statement.NodeId}.output.sql";
        sb.AppendLine($"{indentation}try:");
        sb.AppendLine($"{indentation}    statement = _resolve_workflow_path({WorkflowTemplateHelper.BuildPythonStringLiteral(statementPath)}, workflow_state)");
        sb.AppendLine($"{indentation}    if not statement:");
        sb.AppendLine($"{indentation}        raise ValueError('RunSql could not resolve a SQL statement to execute.')");

        if (buildSqlNode.SqlSourceKind == WorkflowSqlSourceKind.UnityCatalogTable)
        {
            sb.AppendLine($"{indentation}    rows = sql_query_df(str(statement))");
            sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{'status': 'success', 'output': {{'rows': rows}}, 'error': None}}");
            sb.AppendLine($"{indentation}except Exception as e:");
            sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': str(e)}}");
            return;
        }

        if (buildSqlNode.SqlSourceKind != WorkflowSqlSourceKind.LakebaseProvisionedDatabase &&
            buildSqlNode.SqlSourceKind != WorkflowSqlSourceKind.LakebaseAutoscaling)
        {
            throw new InvalidOperationException($"Unsupported BuildSql sqlSourceKind '{buildSqlNode.SqlSourceKind}'.");
        }

        string resourceKey = buildSqlNode.LakebaseAppResourceName?.Trim() ?? string.Empty;
        string connectionEnv = buildSqlNode.SqlSourceKind == WorkflowSqlSourceKind.LakebaseProvisionedDatabase
            ? LakebaseWorkflowEnvNaming.ProvisionedHostEnvironmentVariableName(resourceKey)
            : LakebaseWorkflowEnvNaming.AutoscalingEndpointEnvironmentVariableName(resourceKey);
        string dbEnv = LakebaseWorkflowEnvNaming.DatabaseEnvironmentVariableName(resourceKey);
        string kindLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(
            buildSqlNode.SqlSourceKind == WorkflowSqlSourceKind.LakebaseProvisionedDatabase
                ? "lakebaseProvisionedDatabase"
                : "lakebaseAutoscaling");
        string connectionEnvLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(connectionEnv);
        string dbEnvLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(dbEnv);

        sb.AppendLine($"{indentation}    _vdab_run_sql_result = _vdab_lakebase_run_for_workflow({kindLiteral}, {connectionEnvLiteral}, {dbEnvLiteral}, str(statement))");
        sb.AppendLine($"{indentation}    if isinstance(_vdab_run_sql_result, pd.DataFrame):");
        sb.AppendLine($"{indentation}        workflow_state['{nodeId}'] = {{'status': 'success', 'output': {{'rows': _vdab_run_sql_result}}, 'error': None}}");
        sb.AppendLine($"{indentation}    else:");
        sb.AppendLine($"{indentation}        workflow_state['{nodeId}'] = {{'status': 'success', 'output': {{'rows': None, 'execution': _vdab_run_sql_result}}, 'error': None}}");
        sb.AppendLine($"{indentation}except Exception as e:");
        sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': str(e)}}");
    }
}
