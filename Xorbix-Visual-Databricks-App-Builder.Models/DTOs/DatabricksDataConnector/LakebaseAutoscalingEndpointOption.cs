using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

public class LakebaseAutoscalingEndpointOption
{
    /// <summary>
    /// Logical Postgres database name (e.g. <c>databricks_postgres</c>) from the Lakebase API.
    /// </summary>
    [JsonPropertyName("postgresDatabaseName")]
    public string PostgresDatabaseName { get; set; } = string.Empty;

    /// <summary>
    /// Bare <c>database_id</c> for Databricks Apps <c>postgres.database</c> wire paths
    /// (<c>projects/.../branches/.../databases/{database_id}</c>), when returned by the API.
    /// </summary>
    [JsonPropertyName("appsDatabaseResourceId")]
    public string AppsDatabaseResourceId { get; set; } = string.Empty;

    public string EndpointName { get; set; } = string.Empty;
    public string EndpointId { get; set; } = string.Empty;
    public string EndpointType { get; set; } = string.Empty;
    public double? AutoscalingLimitMinCu { get; set; }
    public double? AutoscalingLimitMaxCu { get; set; }
    public string? SuspendTimeoutDuration { get; set; }
    public string? EffectiveStatus { get; set; }
    public LakebaseAutoscalingSelectorDisplay SelectorDisplay { get; set; } = new();

    /// <summary>
    /// Internal compute endpoint id used to connect to the branch database when the picker row itself
    /// is backed by a <c>db-...</c> database resource id.
    /// </summary>
    [JsonIgnore]
    public string ConnectionEndpointId { get; set; } = string.Empty;

    /// <summary>
    /// Internal compute hostname used for direct Postgres metadata reads.
    /// </summary>
    [JsonIgnore]
    public string ConnectionHost { get; set; } = string.Empty;
}
