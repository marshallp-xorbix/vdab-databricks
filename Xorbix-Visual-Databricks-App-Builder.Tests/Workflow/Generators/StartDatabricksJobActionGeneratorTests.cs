using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Generators;

public class StartDatabricksJobActionGeneratorTests
{
    [Fact]
    public void AppendRuntimeExecution_EmitsJobRunRuntimeAndInfiniteToast()
    {
        StartDatabricksJobActionGenerator generator = new();
        StartDatabricksJobActionModel actionNode = new()
        {
            Id = "start-job",
            Job = new DatabricksJobResourceRef
            {
                WorkspaceConnectionId = 42,
                JobId = "123456",
                JobName = "Sales Sync",
            },
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("job_id = '123456'", runtime);
        Assert.Contains("job_name = 'Sales Sync'", runtime);
        Assert.Contains("run = workspace_client.jobs.run_now(job_id=int(job_id))", runtime);
        Assert.Contains("duration='infinite'", runtime);
        Assert.Contains("'jobId': job_id", runtime);
        Assert.Contains("'jobName': job_name", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_EmitsErrorFallbackState()
    {
        StartDatabricksJobActionGenerator generator = new();
        StartDatabricksJobActionModel actionNode = new()
        {
            Id = "start-job",
            Job = new DatabricksJobResourceRef
            {
                WorkspaceConnectionId = 42,
                JobId = "123456",
                JobName = "Sales Sync",
            },
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("except Exception as e:", runtime);
        Assert.Contains("workflow_state['start-job'] = {'status': 'error', 'output': {}, 'error': str(e)}", runtime);
    }

    private static string GenerateRuntime(StartDatabricksJobActionGenerator generator, StartDatabricksJobActionModel actionNode)
    {
        StringBuilder sb = new();
        generator.AppendRuntimeExecution(
            sb,
            actionNode,
            WorkflowTestTemplateServiceFactory.CreateGenerationContext(new[] { actionNode }, triggerComponentCodeName: "open_claims_button", eventKey: "onClick"),
            triggerComponent: null,
            components: new List<Models.DTOs.BuilderComponents.VdabComponentDto>(),
            indentation: "    ");

        return sb.ToString();
    }
}