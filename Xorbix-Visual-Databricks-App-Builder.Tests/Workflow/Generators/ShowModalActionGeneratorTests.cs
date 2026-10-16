using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Generators;

public class ShowModalActionGeneratorTests
{
    [Fact]
    public void AppendRuntimeExecution_InvokesModalFunctionAndUpdatesState()
    {
        ShowModalActionGenerator generator = new();
        ShowModalActionModel actionNode = new()
        {
            Id = "show-modal",
            ModalCodeName = "claims_modal",
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("show_claims_modal()", runtime);
        Assert.Contains("workflow_state['show-modal'] = {'status': 'success', 'output': {'visible': True}, 'error': None}", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_ThrowsWhenModalCodeNameIsMissing()
    {
        ShowModalActionGenerator generator = new();
        ShowModalActionModel actionNode = new()
        {
            Id = "show-modal",
            ModalCodeName = string.Empty,
        };

        InvalidOperationException exception = Assert.Throws<InvalidOperationException>(() => GenerateRuntime(generator, actionNode));

        Assert.Contains("missing a validated modal code name", exception.Message);
    }

    private static string GenerateRuntime(ShowModalActionGenerator generator, ShowModalActionModel actionNode)
    {
        StringBuilder sb = new();
        generator.AppendRuntimeExecution(
            sb,
            actionNode,
            WorkflowTestTemplateServiceFactory.CreateGenerationContext(new[] { actionNode }),
            triggerComponent: null,
            components: new List<Models.DTOs.BuilderComponents.VdabComponentDto>(),
            indentation: "    ");

        return sb.ToString();
    }
}