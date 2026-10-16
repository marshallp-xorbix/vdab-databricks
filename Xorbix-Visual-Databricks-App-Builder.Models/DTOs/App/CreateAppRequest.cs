using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;

/// <summary>
/// Determines how VDAB app creation handles Databricks app linkage.
/// </summary>
public enum DatabricksAppCreationMode
{
    LinkExisting = 0,
    CreateNew = 1,
}

/// <summary>
/// Request DTO for creating a new app
/// </summary>
public class CreateAppRequest
{
    public required string AppName { get; set; }
    public string? Description { get; set; }
    public int WorkspaceConnectionId { get; set; }
    public DatabricksAppCreationMode DatabricksAppMode { get; set; } = DatabricksAppCreationMode.LinkExisting;
    public string? DatabricksAppName { get; set; }
    public string? DatabricksAppDescription { get; set; }
    public List<DatabricksAppResource>? DatabricksAppResources { get; set; }
    public string? WorkspacePath { get; set; }
    public string? Theme { get; set; }
    public string WorkflowDefinition { get; set; } = "{\"version\":1,\"workflows\":[]}";

    /// <summary>
    /// Optional initial <c>custom_modules.py</c> body; when omitted a default scaffold is stored.
    /// </summary>
    public string? CustomModulesCode { get; set; }

}

