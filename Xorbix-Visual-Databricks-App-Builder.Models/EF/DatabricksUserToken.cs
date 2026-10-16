using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents a per-user Databricks refresh token for a specific workspace connection.
/// Allows multiple users to authorize against the same workspace without overwriting shared connection data.
/// </summary>
public class DatabricksUserToken : TrackableEntity
{
    /// <summary>
    /// Primary key for the user token record.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int DatabricksUserTokenId { get; set; }

    /// <summary>
    /// Foreign key referencing the ApplicationUser who owns this token.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property for the associated user.
    /// </summary>
    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser? User { get; set; }

    /// <summary>
    /// Foreign key referencing the DatabricksConnection (workspace) this token is for.
    /// </summary>
    public int WorkspaceConnectionId { get; set; }

    /// <summary>
    /// Navigation property for the associated Databricks workspace connection.
    /// </summary>
    [ForeignKey(nameof(WorkspaceConnectionId))]
    public virtual DatabricksConnection? WorkspaceConnection { get; set; }

    /// <summary>
    /// The encrypted refresh token used to obtain new access tokens.
    /// Encrypted/decrypted transparently by the repository layer.
    /// </summary>
    [MaxLength(2048)]
    public string? RefreshToken { get; set; }

    /// <summary>
    /// When the refresh token expires.
    /// </summary>
    public DateTime? RefreshTokenExpiresAt { get; set; }

    /// <summary>
    /// When the refresh token was last rotated.
    /// </summary>
    public DateTime? LastRotatedAt { get; set; }

    /// <summary>
    /// When the refresh token was revoked (null if still active).
    /// </summary>
    public DateTime? RevokedAt { get; set; }
}
