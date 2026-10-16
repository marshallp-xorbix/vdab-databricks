using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents a refresh token for JWT authentication.
/// </summary>
public class RefreshToken
{
    /// <summary>
    /// Gets or sets the unique identifier for the refresh token.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the user ID associated with this refresh token.
    /// </summary>
    [Required]
    public Guid UserId { get; set; }

    /// <summary>
    /// Gets or sets the tenant context this session was minted under.
    /// Null for legacy rows minted before Phase 4 tenant-scoped sessions.
    /// </summary>
    public Guid? TenantId { get; set; }

    /// <summary>
    /// Gets or sets the refresh token value.
    /// </summary>
    [Required]
    [MaxLength(512)]
    public required string Token { get; set; }

    /// <summary>
    /// Gets or sets when the refresh token expires.
    /// </summary>
    [Required]
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Gets or sets when the refresh token was created.
    /// </summary>
    [Required]
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether the refresh token has been revoked.
    /// </summary>
    public bool IsRevoked { get; set; }

    /// <summary>
    /// Gets or sets when the refresh token was revoked, if applicable.
    /// </summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>
    /// Gets or sets the IP address from which the token was created.
    /// </summary>
    [MaxLength(45)]
    public string? IpAddress { get; set; }

    /// <summary>
    /// Gets or sets the user agent (browser/device) from which the token was created.
    /// </summary>
    [MaxLength(512)]
    public string? UserAgent { get; set; }

    /// <summary>
    /// Gets or sets the city resolved from the IP address via geolocation.
    /// </summary>
    [MaxLength(100)]
    public string? City { get; set; }

    /// <summary>
    /// Gets or sets the country resolved from the IP address via geolocation.
    /// </summary>
    [MaxLength(100)]
    public string? Country { get; set; }

    /// <summary>
    /// Gets or sets the region/state resolved from the IP address via geolocation.
    /// </summary>
    [MaxLength(100)]
    public string? Region { get; set; }

    /// <summary>
    /// Gets or sets the replaced by token ID when this token is rotated.
    /// </summary>
    public int? ReplacedByTokenId { get; set; }

    /// <summary>
    /// Gets or sets the session identifier shared by every refresh token in a rotation chain.
    /// All tokens minted by rotating from a single login share the same SessionId. Used to
    /// surface "one row per login" in the user-facing session list and to bound reuse-detection
    /// blast radius to a single session.
    /// </summary>
    [Required]
    public Guid SessionId { get; set; }

    /// <summary>
    /// Navigation property to the associated user.
    /// </summary>
    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser User { get; set; } = null!;

    /// <summary>
    /// Navigation property to the token that replaced this one (if rotated).
    /// </summary>
    [ForeignKey(nameof(ReplacedByTokenId))]
    public virtual RefreshToken? ReplacedByToken { get; set; }

    /// <summary>
    /// Gets a value indicating whether the refresh token is active (not expired and not revoked).
    /// </summary>
    [NotMapped]
    public bool IsActive => !IsRevoked && ExpiresAt > DateTime.UtcNow;

    /// <summary>
    /// Gets a value indicating whether the refresh token has expired.
    /// </summary>
    [NotMapped]
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
}
