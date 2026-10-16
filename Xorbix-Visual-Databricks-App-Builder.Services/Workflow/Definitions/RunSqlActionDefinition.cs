using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

internal sealed class RunSqlActionDefinition : WorkflowActionDefinitionBase<RunSqlActionModel>
{
    public RunSqlActionDefinition()
        : base(WorkflowActionKind.RunSql)
    {
    }

    protected override Result ValidateTyped(RunSqlActionModel actionNode, WorkflowActionValidationContext context)
    {
        if (actionNode.Statement == null)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a statement source."));
        }

        if (actionNode.Statement.SourceActionType != RunSqlStatementSourceActionType.BuildSql)
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires statement.sourceActionType to be BuildSql."));
        }

        if (string.IsNullOrWhiteSpace(actionNode.Statement.NodeId))
        {
            return Result.Fail(new ValidationError($"Workflow '{context.Workflow.CodeName}' node '{actionNode.Id}' requires a source BuildSql node."));
        }

        return Result.Ok();
    }
}