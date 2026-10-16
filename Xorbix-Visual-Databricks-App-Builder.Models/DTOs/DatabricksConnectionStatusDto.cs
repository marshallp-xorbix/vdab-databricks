namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs;

/// <summary>
/// A read-only projection of a Databricks workspace connection enriched with
/// the current user's authorization status.
/// </summary>
public class DatabricksConnectionStatusDto
{
    /// <summary>Primary key of the connection.</summary>
    public int PkId { get; init; }

    /// <summary>Human-readable display name for the workspace.</summary>
    public string WorkspaceDisplayName { get; init; } = string.Empty;

    /// <summary>Databricks workspace URL.</summary>
    public string WorkspaceUrl { get; init; } = string.Empty;

    /// <summary>OAuth client ID configured for this connection.</summary>
    public string? ClientId { get; init; }

    /// <summary>
    /// True when the current user has a valid (non-expired, non-revoked) refresh token
    /// for this workspace connection.
    /// </summary>
    public bool IsAuthorized { get; init; }

    /// <summary>
    /// When the current user's refresh token expires.
    /// Null when no lifespan is configured or the user has no token.
    /// </summary>
    public DateTime? TokenExpiresAt { get; init; }
}
