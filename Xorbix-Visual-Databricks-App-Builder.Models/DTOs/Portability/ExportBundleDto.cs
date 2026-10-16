namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

/// <summary>
/// Identifies the kind of records contained in an <see cref="ExportBundleDto"/>.
/// </summary>
public static class ExportBundleTypes
{
    /// <summary>Bundle contains exported apps.</summary>
    public const string Apps = "apps";

    /// <summary>Bundle contains exported Databricks connections.</summary>
    public const string Connections = "connections";
}

/// <summary>
/// Versioned envelope wrapping a set of exported apps or Databricks connections.
/// </summary>
public class ExportBundleDto
{
    /// <summary>
    /// The schema version of the bundle, used to guard future format changes.
    /// </summary>
    public int SchemaVersion { get; set; } = 1;

    /// <summary>
    /// The UTC timestamp at which the bundle was produced.
    /// </summary>
    public DateTime ExportedAt { get; set; }

    /// <summary>
    /// The kind of records in the bundle. See <see cref="ExportBundleTypes"/>.
    /// </summary>
    public required string Type { get; set; }

    /// <summary>
    /// The exported apps, when <see cref="Type"/> is <see cref="ExportBundleTypes.Apps"/>.
    /// </summary>
    public List<AppExportDto>? Apps { get; set; }

    /// <summary>
    /// The exported connections, when <see cref="Type"/> is <see cref="ExportBundleTypes.Connections"/>.
    /// </summary>
    public List<DatabricksConnectionExportDto>? Connections { get; set; }
}
