using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed class StartDatabricksJobActionDefinition : WorkflowActionDefinitionBase<StartDatabricksJobActionModel>
{
    public StartDatabricksJobActionDefinition()
        : base(WorkflowActionKind.StartDatabricksJob)
    {
    }

    protected override Result ValidateTyped(StartDatabricksJobActionModel actionNode, WorkflowActionValidationContext context)
    {
        if (actionNode.Job == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a Databricks job reference."));
        }

        if (actionNode.Job.WorkspaceConnectionId <= 0)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a workspace connection ID for StartDatabricksJob."));
        }

        if (string.IsNullOrWhiteSpace(actionNode.Job.JobId))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a Databricks job ID."));
        }

        if (string.IsNullOrWhiteSpace(actionNode.Job.JobName))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a Databricks job name."));
        }

        return Result.Ok();
    }
}