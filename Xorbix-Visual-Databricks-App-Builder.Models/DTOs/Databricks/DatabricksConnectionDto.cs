namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;

/// <summary>
/// Public API representation of a Databricks workspace connection.
/// </summary>
public class DatabricksConnectionDto
{
    /// <summary>
    /// Primary key for the connection record.
    /// </summary>
    public int PkId { get; init; }

    /// <summary>
    /// Foreign key referencing the tenant that owns this connection.
    /// </summary>
    public Guid? TenantId { get; init; }

    /// <summary>
    /// Foreign key referencing the user who created or owns this connection.
    /// </summary>
    public Guid OwnerId { get; init; }

    /// <summary>
    /// The URL for the Databricks workspace.
    /// </summary>
    public required string WorkspaceUrl { get; init; }

    /// <summary>
    /// The display name for the Databricks workspace.
    /// </summary>
    public required string WorkspaceDisplayName { get; init; }

    /// <summary>
    /// The OAuth client ID used for authentication.
    /// </summary>
    public string? ClientId { get; init; }

    /// <summary>
    /// The access token time-to-live in minutes.
    /// </summary>
    public int? AccessTokenTtlMinutes { get; init; }

    /// <summary>
    /// The refresh token lifespan in minutes.
    /// </summary>
    public int? RefreshTokenLifespanMinutes { get; init; }

    /// <summary>
    /// Gets the date and time when the entity was created.
    /// </summary>
    public DateTime CreatedOn { get; init; }

    /// <summary>
    /// Gets the user ID who created the entity.
    /// </summary>
    public Guid? CreatedBy { get; init; }

    /// <summary>
    /// Gets the date and time when the entity was last modified.
    /// </summary>
    public DateTime? ModifiedOn { get; init; }

    /// <summary>
    /// Gets the user ID who last modified the entity.
    /// </summary>
    public Guid? ModifiedBy { get; init; }
}
