namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

/// <summary>
/// Portable representation of an app used for export/import.
/// Excludes all identity, ownership, tenant, and audit fields so the app can be
/// recreated under a different tenant and owner. The owning Databricks connection
/// is referenced only by <see cref="WorkspaceUrl"/> so the importer can pre-select a
/// matching connection; the actual link is resolved at import time.
/// </summary>
public class AppExportDto
{
    /// <summary>
    /// The display name of the app.
    /// </summary>
    public required string AppName { get; set; }

    /// <summary>
    /// The name of the app in Databricks.
    /// </summary>
    public string? DatabricksAppName { get; set; }

    /// <summary>
    /// The description of the app.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// The workspace path where the app files are uploaded.
    /// </summary>
    public string? WorkspacePath { get; set; }

    /// <summary>
    /// The version of the app.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// The JSON theme of colors.
    /// </summary>
    public string? Theme { get; set; }

    /// <summary>
    /// The app-level workflow definition document.
    /// </summary>
    public string WorkflowDefinition { get; set; } = "{\"version\":1,\"workflows\":[]}";

    /// <summary>
    /// User-editable Python module contents persisted for the app.
    /// </summary>
    public string? CustomModulesCode { get; set; }

    /// <summary>
    /// The workspace URL of the connection the app was bound to at export time.
    /// Reference only; used by the importer to pre-select a matching connection.
    /// </summary>
    public string? WorkspaceUrl { get; set; }

    /// <summary>
    /// The components that make up the app.
    /// </summary>
    public List<AppComponentExportDto> Components { get; set; } = [];
}
