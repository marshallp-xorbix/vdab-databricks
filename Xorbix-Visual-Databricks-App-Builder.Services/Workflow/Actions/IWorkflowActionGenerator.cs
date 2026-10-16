using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions;

/// <summary>
/// Interface for generating Streamlit Python code for a specific type of workflow action.
/// </summary>
public interface IWorkflowActionGenerator
{
    /// <summary>
    /// The specific action kind this generator handles.
    /// </summary>
    WorkflowActionKind ActionKind { get; }

    /// <summary>
    /// The typed workflow action model this generator accepts.
    /// </summary>
    Type ActionModelType { get; }

}

public sealed class WorkflowActionGenerationContext
{
    public required WorkflowModel Workflow { get; init; }

    public required IReadOnlyDictionary<string, WorkflowActionNodeModel> NodesById { get; init; }
}

/// <summary>
/// Interface for generating runtime code from a typed workflow action model.
/// </summary>
public interface IWorkflowActionGenerator<in TActionNode> : IWorkflowActionGenerator
    where TActionNode : WorkflowActionNodeModel
{

    /// <summary>
    /// Appends the workflow node's execution logic to the provided StringBuilder.
    /// </summary>
    void AppendRuntimeExecution(
        StringBuilder sb,
        TActionNode actionNode,
        WorkflowActionGenerationContext generationContext,
        VdabComponentDto? triggerComponent,
        List<VdabComponentDto> components,
        string indentation);
}

public abstract class WorkflowActionGeneratorBase<TActionNode> : IWorkflowActionGenerator<TActionNode>
    where TActionNode : WorkflowActionNodeModel
{
    public Type ActionModelType => typeof(TActionNode);

    public abstract WorkflowActionKind ActionKind { get; }

    public abstract void AppendRuntimeExecution(
        StringBuilder sb,
        TActionNode actionNode,
        WorkflowActionGenerationContext generationContext,
        VdabComponentDto? triggerComponent,
        List<VdabComponentDto> components,
        string indentation);
}
