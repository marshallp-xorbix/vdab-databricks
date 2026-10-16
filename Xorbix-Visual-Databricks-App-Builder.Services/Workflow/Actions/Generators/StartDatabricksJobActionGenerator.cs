using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;

public class StartDatabricksJobActionGenerator : WorkflowActionGeneratorBase<StartDatabricksJobActionModel>
{
    public override WorkflowActionKind ActionKind => WorkflowActionKind.StartDatabricksJob;

    public override void AppendRuntimeExecution(StringBuilder sb, StartDatabricksJobActionModel actionNode, WorkflowActionGenerationContext generationContext, VdabComponentDto? triggerComponent, List<VdabComponentDto> components, string indentation)
    {
        string nodeId = WorkflowTemplateHelper.EscapePythonString(actionNode.Id);
        string jobIdLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(actionNode.Job.JobId);
        string jobNameLiteral = WorkflowTemplateHelper.BuildPythonStringLiteral(actionNode.Job.JobName);
        sb.AppendLine($"{indentation}job_id = {jobIdLiteral}");
        sb.AppendLine($"{indentation}job_name = {jobNameLiteral}");
        sb.AppendLine($"{indentation}try:");
        sb.AppendLine($"{indentation}    workspace_client = WorkspaceClient(product=PARTNER_NAME, product_version=PARTNER_VERSION)");
        sb.AppendLine($"{indentation}    run = workspace_client.jobs.run_now(job_id=int(job_id))");
        sb.AppendLine($"{indentation}    run_id = str(run.run_id)");
        sb.AppendLine($"{indentation}    st.toast(f\"Started Databricks job {{job_name}} (Job ID: {{job_id}}, Run ID: {{run_id}})\", icon=':material/play_arrow:', duration='infinite')");
        sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{'status': 'success', 'output': {{'runId': run_id, 'jobId': job_id, 'jobName': job_name, 'status': 'started'}}, 'error': None}}");
        sb.AppendLine($"{indentation}except Exception as e:");
        sb.AppendLine($"{indentation}    workflow_state['{nodeId}'] = {{'status': 'error', 'output': {{}}, 'error': str(e)}}");
    }
}
