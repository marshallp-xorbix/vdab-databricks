using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;

public interface IWorkflowActionDefinition
{
    WorkflowActionKind ActionKind { get; }

    Type ActionModelType { get; }

    Result Validate(WorkflowActionNodeModel actionNode, WorkflowActionValidationContext context);
}

public sealed class WorkflowActionValidationContext
{
    public required WorkflowDefinitionModel WorkflowDefinition { get; init; }

    public required WorkflowModel Workflow { get; init; }

    public required IReadOnlyDictionary<string, VdabComponentDto> ComponentsByCodeName { get; init; }

    public required IReadOnlyDictionary<string, VdabComponentDto> ComponentsById { get; init; }

    /// <summary>
    /// When provided (e.g. deploy with saved App Settings), Lakebase BuildSql selections are cross-checked against attached resources.
    /// </summary>
    public IReadOnlyList<NormalizedAppResourceDto>? NormalizedAppResources { get; init; }
}