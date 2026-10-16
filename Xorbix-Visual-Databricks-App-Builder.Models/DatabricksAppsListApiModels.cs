using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// JSON shape for a page of <c>GET /api/2.0/apps</c> (Databricks Apps list).
/// </summary>
public sealed class DatabricksAppsListPage
{
    [JsonPropertyName("apps")]
    public List<DatabricksAppListItem>? Apps { get; set; }

    [JsonPropertyName("next_page_token")]
    public string? NextPageToken { get; set; }
}

/// <summary>
/// One app entry in the Apps list response.
/// </summary>
public sealed class DatabricksAppListItem
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }
}
