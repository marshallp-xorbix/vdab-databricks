using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;

/// <summary>
/// Response DTO for App entity
/// </summary>
public class AppDto : TrackableEntity
{
    public int Id { get; set; }
    public Guid OwnerId { get; set; }
    public string? OwnerEmail { get; set; }
    public required string AppName { get; set; }
    public string? DatabricksAppName { get; set; }
    public string? Description { get; set; }
    public Guid? TenantId { get; set; }
    public int WorkspaceConnectionId { get; set; }
    public string? WorkspacePath { get; set; }
    public int Version { get; set; }
    public DateTime? LastPublishedAt { get; set; }
    public string? Theme { get; set; }
    public string WorkflowDefinition { get; set; } = "{\"version\":1,\"workflows\":[]}";

    /// <summary>
    /// Contents of <c>custom_modules.py</c> persisted for this app.
    /// </summary>
    public string? CustomModulesCode { get; set; }
}

