using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

[ExcludeFromCodeCoverage]
public sealed class AuditArchiveConfiguration
{
    public const string ConfigurationSectionName = "AuditArchiveConfiguration";

    /// <summary>
    /// Local file path where the MaxMind AuditArchive-City database file (.mmdb) is stored or cached.
    /// If not configured or file not found, audit archive features will be unavailable.
    /// </summary>
    public string? DatabasePath { get; set; }

    /// <summary>
    /// Azure Blob Storage container URI (e.g., <c>https://account.blob.core.windows.net/audit-archive</c>).
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
