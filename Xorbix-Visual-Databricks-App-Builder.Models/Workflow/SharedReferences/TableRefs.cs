namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;

/// <summary>
/// Structured workflow table references.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/sharedReferences.ts
/// </summary>
public abstract class SaveTargetTableRef
{
    public required int WorkspaceConnectionId { get; init; }

    public required string Catalog { get; init; }

    public required string Schema { get; init; }

    public required string Table { get; init; }

    public abstract string TableType { get; }
}

public sealed class UnityCatalogTableRef : SaveTargetTableRef
{
    public override string TableType => "unityCatalogTable";
}

public sealed class LakebaseTableRef : SaveTargetTableRef
{
    public required string InstanceName { get; init; }

    public required string Database { get; init; }

    public override string TableType => "lakebaseProvisionedDatabase";
}

public sealed class LakebaseAutoscalingTableRef : SaveTargetTableRef
{
    public required string ProjectId { get; init; }

    public required string BranchId { get; init; }

    public required string EndpointId { get; init; }

    public required string Database { get; init; }

    public override string TableType => "lakebaseAutoscaling";
}