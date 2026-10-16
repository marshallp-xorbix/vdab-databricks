namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

/// <summary>
/// Portable representation of a Databricks workspace connection used for export/import.
/// Excludes all identity, ownership, tenant, audit fields and the client secret so the
/// connection can be recreated under a different tenant and owner.
/// </summary>
public class DatabricksConnectionExportDto
{
    /// <summary>
    /// The URL for the Databricks workspace.
    /// </summary>
    public required string WorkspaceUrl { get; set; }

    /// <summary>
    /// The display name for the Databricks workspace.
    /// </summary>
    public required string WorkspaceDisplayName { get; set; }

    /// <summary>
    /// The OAuth client ID. The client secret is intentionally never exported.
    /// </summary>
    public string? ClientId { get; set; }

    /// <summary>
    /// The access token time-to-live (TTL) in minutes.
    /// </summary>
    public int? AccessTokenTtlMinutes { get; set; }

    /// <summary>
    /// The refresh token lifespan in minutes.
    /// </summary>
    public int? RefreshTokenLifespanMinutes { get; set; }
}
