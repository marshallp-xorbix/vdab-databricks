namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;

/// <summary>
/// Request body for updating an existing Databricks workspace connection by primary key.
/// </summary>
public class UpdateDatabricksConnectionRequest
{
    /// <summary>
    /// HTTPS URL of the Databricks workspace.
    /// </summary>
    public required string WorkspaceUrl { get; set; }

    /// <summary>
    /// Display name shown in the VDAB workspace list.
    /// </summary>
    public required string WorkspaceDisplayName { get; set; }

    /// <summary>
    /// OAuth client ID from the Databricks app connection.
    /// </summary>
    public string? ClientId { get; set; }

    /// <summary>
    /// OAuth client secret from the Databricks app connection. When omitted or blank, the existing secret is kept.
    /// </summary>
    public string? ClientSecret { get; set; }

    /// <summary>
    /// Access token TTL in minutes, as configured in Databricks.
    /// </summary>
    public int? AccessTokenTtlMinutes { get; set; }

    /// <summary>
    /// Refresh token lifespan in minutes, as configured in Databricks.
    /// </summary>
    public int? RefreshTokenLifespanMinutes { get; set; }
}
