using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Normalized App Settings section for <c>GET /api/AppActions/&#123;appId&#125;/details</c>.
/// This is the long-term contract for resources and compute size; prefer over legacy root fields.
/// </summary>
public class AppSettingsDetailsDto
{
    /// <summary>
    /// Resources mapped from the Databricks app payload.
    /// </summary>
    public List<NormalizedAppResourceDto> Resources { get; set; } = new();

    /// <summary>
    /// Databricks compute size for the app.
    /// </summary>
    public string ComputeSize { get; set; } = string.Empty;

    /// <summary>
    /// Non-fatal issues encountered while mapping (e.g. unknown resource type keys).
    /// </summary>
    public List<AppSettingsWarningDto> Warnings { get; set; } = new();
}

/// <summary>
/// A single app resource in normalized form with an explicit <see cref="Kind"/> discriminator.
/// </summary>
public class NormalizedAppResourceDto
{
    /// <summary>
    /// Resource category: <c>sql_warehouse</c>, <c>job</c>, <c>database</c>, <c>autoscaling_database</c>,
    /// <c>secret</c>, <c>experiment</c>, <c>genie_space</c>, <c>serving_endpoint</c>, or <c>uc_securable</c>.
    /// </summary>
    public string Kind { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public SqlWarehouseResource? SqlWarehouse { get; set; }

    public JobResource? Job { get; set; }

    public DatabaseResource? Database { get; set; }

    public SecretResource? Secret { get; set; }

    public ExperimentResource? Experiment { get; set; }

    public GenieSpaceResource? GenieSpace { get; set; }

    public ServingEndpointResource? ServingEndpoint { get; set; }

    public UcSecurableResource? UcSecurable { get; set; }
}

/// <summary>
/// A non-fatal mapping warning for App Settings details.
/// </summary>
public class AppSettingsWarningDto
{
    /// <summary>
    /// Stable code (e.g. <c>unknown_resource_type</c>).
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable explanation.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Zero-based index in the Databricks <c>resources</c> array, when applicable.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? ResourceIndex { get; set; }

    /// <summary>
    /// Unknown property key from the Databricks payload, when applicable.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? UnknownTypeKey { get; set; }
}
