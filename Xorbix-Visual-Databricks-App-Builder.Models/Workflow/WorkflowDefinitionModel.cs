namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

/// <summary>
/// Parsed workflow document model.
/// Frontend siblings:
/// xorbix-visual-databricks-app-builder.client/src/types/workflow/workflowDefinition.ts
/// xorbix-visual-databricks-app-builder.client/src/types/workflow/actionNode.ts
/// </summary>
public class WorkflowDefinitionModel
{
    public int Version { get; init; } = 1;

    public List<WorkflowModel> Workflows { get; init; } = new();
}

public class WorkflowModel
{
    public required string CodeName { get; init; }

    public required WorkflowTriggerModel Trigger { get; init; }

    public List<WorkflowActionNodeModel> Nodes { get; init; } = new();

    public List<WorkflowEdgeModel> Edges { get; init; } = new();
}

public class WorkflowTriggerModel
{
    public required string ComponentCodeName { get; init; }

    public required string EventKey { get; init; }
}

public abstract class WorkflowActionNodeModel
{
    public required string Id { get; init; }

    public int SchemaVersion { get; init; } = 1;

    public abstract WorkflowActionKind ActionType { get; }
}

public class WorkflowEdgeModel
{
    public required string FromNodeId { get; init; }

    public required string ToNodeId { get; init; }

    public required WorkflowRouteModel Route { get; init; }
}