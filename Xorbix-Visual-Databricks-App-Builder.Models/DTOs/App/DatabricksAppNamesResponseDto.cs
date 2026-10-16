namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;

/// <summary>
/// Response for listing Databricks app <c>name</c> values only, sorted case-insensitively.
/// Used by <c>GET /api/AppActions/{appId}/databricks-app-names</c> (app-scoped) and
/// <c>GET /api/AppActions/databricks-app-names</c> (workspace connection only, no VDAB app).
/// </summary>
public sealed class DatabricksAppNamesResponseDto
{
    /// <summary>
    /// App names from the Databricks Apps list API for the workspace.
    /// </summary>
    public IReadOnlyList<string> AppNames { get; init; } = Array.Empty<string>();
}
