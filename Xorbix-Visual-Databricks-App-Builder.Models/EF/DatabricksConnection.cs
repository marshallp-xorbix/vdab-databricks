using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents a Databricks workspace connection tied to an application user.
/// </summary>
public class DatabricksConnection : TrackableEntity
{
    /// <summary>
    /// Primary key for the connection record.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int PkId { get; set; } //TODO: Rename to DatabricksConnectionId in future migration

    /// <summary>
    /// Foreign key referencing the tenant that owns this connection.
    /// </summary>
    public Guid? TenantId { get; set; } //TODO: Make non-nullable in future migration

    /// <summary>
    /// Navigation property for the tenant.
    /// </summary>
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? Tenant { get; set; }

    /// <summary>
    /// Foreign key referencing the ApplicationUser who created/owns this connection.
    /// </summary>
    public Guid OwnerId { get; set; }

    /// <summary>
    /// Navigation property for the associated user.
    /// </summary>
    [ForeignKey(nameof(OwnerId))]
    public virtual ApplicationUser? User { get; set; }

    /// <summary>
    /// The URL for the Databricks workspace.
    /// </summary>
    [Required]
    [MaxLength(255)]
    public required string WorkspaceUrl { get; set; }

    /// <summary>
    /// The display name for the Databricks workspace.
    /// </summary>
    [Required]
    [MaxLength(255)]
    public required string WorkspaceDisplayName { get; set; }

    /// <summary>
    /// The client ID used for OAuth authentication.
    /// </summary>
    [MaxLength(255)]
    public string? ClientId { get; set; }

    /// <summary>
    /// The client secret used for OAuth authentication (should be stored securely).
    /// </summary>
    [MaxLength(255)]
    public string? ClientSecret { get; set; }

    /// <summary>
    /// The access token time-to-live (TTL) in minutes.
    /// This is the lifespan of the access token issued by Databricks.
    /// </summary>
    public int? AccessTokenTtlMinutes { get; set; }

    /// <summary>
    /// The refresh token lifespan in minutes.
    /// Must be between AccessTokenTtlMinutes and 129,600 minutes (90 days).
    /// Set in the Databricks account app connections settings.
    /// </summary>
    public int? RefreshTokenLifespanMinutes { get; set; }

}
