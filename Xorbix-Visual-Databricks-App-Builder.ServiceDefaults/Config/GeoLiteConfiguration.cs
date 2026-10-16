using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

[ExcludeFromCodeCoverage]
public sealed class GeoLiteConfiguration
{
    public const string ConfigurationSectionName = "GeoLiteConfiguration";

    /// <summary>
    /// Local file path where the MaxMind GeoLite2-City database file (.mmdb) is stored or cached.
    /// If not configured or file not found, geolocation features will be unavailable.
    /// </summary>
    public string? DatabasePath { get; set; }

    /// <summary>
    /// Azure Blob Storage container URI (e.g., <c>https://account.blob.core.windows.net/geolite</c>).
    /// When configured, the app lists blobs in this container on startup, selects the most recently
    /// uploaded file, downloads it, and extracts the <c>.mmdb</c> database to <see cref="DatabasePath"/>.
    /// </summary>
    public string? ContainerUri { get; set; }

    /// <summary>
    /// MaxMind account ID. Required for downloading database updates via the MaxMind API.
    /// </summary>
    public string? AccountId { get; set; }

    /// <summary>
    /// MaxMind license key. Required for downloading database updates via the MaxMind API.
    /// </summary>
    public string? LicenseKey { get; set; }
}
