namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

/// <summary>
/// Databricks workspace metadata and attribution fields loaded for an AI Builder session.
/// </summary>
public sealed class AiBuilderDatabricksContext
{
    public required int WorkspaceConnectionId { get; init; }

    public required string Context { get; init; }

    public required string AppName { get; init; }

    public required string TenantName { get; init; }
}
