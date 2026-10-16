using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Generators;

public class TriggerToastActionGeneratorTests
{
    [Theory]
    [InlineData(ToastPresetDuration.Short, "duration='short'")]
    [InlineData(ToastPresetDuration.Long, "duration='long'")]
    [InlineData(ToastPresetDuration.Infinite, "duration='infinite'")]
    public void AppendRuntimeExecution_UsesPresetToastDurations(ToastPresetDuration duration, string expectedDuration)
    {
        TriggerToastActionGenerator generator = new();
        TriggerToastActionModel actionNode = new()
        {
            Id = "toast-1",
            Body = "Saved",
            Icon = ":material/check:",
            Duration = new ToastPresetDurationModel
            {
                Value = duration,
            },
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("_vdab_enqueue_toast('Saved', icon=':material/check:'", runtime);
        Assert.Contains(expectedDuration, runtime);
        Assert.Contains("workflow_state['toast-1'] = {'status': 'success', 'output': {'shown': True}, 'error': None}", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_UsesNumericSecondsDuration()
    {
        TriggerToastActionGenerator generator = new();
        TriggerToastActionModel actionNode = new()
        {
            Id = "toast-2",
            Body = "Filters updated",
            Duration = new ToastSecondsDurationModel
            {
                Value = 12,
            },
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("_vdab_enqueue_toast('Filters updated', duration=12)", runtime);
        Assert.DoesNotContain("duration='medium'", runtime);
    }

    private static string GenerateRuntime(TriggerToastActionGenerator generator, TriggerToastActionModel actionNode)
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