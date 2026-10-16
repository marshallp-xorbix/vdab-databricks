namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;

/// <summary>
/// Request DTO for updating an existing app
/// </summary>
public class UpdateAppRequest
{
    public required string AppName { get; set; }
    public string? DatabricksAppName { get; set; }
    public string? Description { get; set; }
    public string? Theme { get; set; }

    public int WorkspaceConnectionId { get; set; }
    public string? WorkspacePath { get; set; }
    public int Version { get; set; }
    public DateTime? LastPublishedAt { get; set; }
    public string WorkflowDefinition { get; set; } = "{\"version\":1,\"workflows\":[]}";

    /// <summary>
    /// Updated <c>custom_modules.py</c> body for the app.
    /// </summary>
    public string? CustomModulesCode { get; set; }
}

