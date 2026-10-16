using System.Text.Json.Serialization;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;

/// <summary>
/// Request body for <c>POST /api/AppActions/databricks-apps</c> (creates an app in Databricks only; no VDAB persistence).
/// </summary>
public sealed class CreateDatabricksAppRequestDto
{
    /// <summary>
    /// Workspace connection to call Databricks as.
    /// </summary>
    public int WorkspaceConnectionId { get; init; }

    /// <summary>
    /// Databricks app name (required by Databricks create API).
    /// </summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// Optional description forwarded to Databricks.
    /// </summary>
    public string? Description { get; init; }

    /// <summary>
    /// Optional resources array forwarded to Databricks <c>POST /api/2.0/apps</c>.
    /// </summary>
    public List<DatabricksAppResource>? Resources { get; init; }
}

/// <summary>
/// JSON body for Databricks <c>POST /api/2.0/apps</c>.
/// </summary>
public sealed class CreateDatabricksAppApiRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("resources")]
    public List<DatabricksAppResource>? Resources { get; set; }
}

/// <summary>
/// VDAB response after a successful Databricks app create.
/// </summary>
public sealed class CreatedDatabricksAppDto
{
    /// <summary>
    /// Canonical app name from Databricks.
    /// </summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// Databricks <c>update_time</c> when present.
    /// </summary>
    public string? UpdateTime { get; init; }

    /// <summary>
    /// App URL when returned by Databricks.
    /// </summary>
    public string? Url { get; init; }
}
