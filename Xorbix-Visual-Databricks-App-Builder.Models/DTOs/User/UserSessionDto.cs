namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Represents a user session (one rotation chain of refresh tokens — i.e. one login)
/// with parsed device and location information.
/// </summary>
public class UserSessionDto
{
    /// <summary>
    /// The session identifier shared by every refresh token in the rotation chain.
    /// Stable across rotations — this is what identifies "one login" to the UI.
    /// </summary>
    public required Guid SessionId { get; init; }

    /// <summary>
    /// The ID of the live (or most recent) refresh token in the chain. Used as the
    /// action target when revoking the session.
    /// </summary>
    public required int Id { get; init; }

    /// <summary>
    /// The IP address from which the session was created (latest token in the chain).
    /// </summary>
    public string? IpAddress { get; init; }

    /// <summary>
    /// The raw user agent string (latest token in the chain).
    /// </summary>
    public string? UserAgent { get; init; }

    /// <summary>
    /// The parsed browser name and version (e.g., "Chrome 120").
    /// </summary>
    public string? Browser { get; init; }

    /// <summary>
    /// The parsed operating system name and version (e.g., "Windows 10").
    /// </summary>
    public string? OperatingSystem { get; init; }

    /// <summary>
    /// The parsed device type (e.g., "Desktop", "Mobile", "Tablet").
    /// </summary>
    public string? DeviceType { get; init; }

    /// <summary>
    /// The city resolved from the IP address.
    /// </summary>
    public string? City { get; init; }

    /// <summary>
    /// The country resolved from the IP address.
    /// </summary>
    public string? Country { get; init; }

    /// <summary>
    /// The region/state resolved from the IP address.
    /// </summary>
    public string? Region { get; init; }

    /// <summary>
    /// When the session was first established (earliest CreatedAt across the chain).
    /// </summary>
    public required DateTime FirstSeenAt { get; init; }

    /// <summary>
    /// When the session most recently rotated (latest CreatedAt across the chain).
    /// </summary>
    public required DateTime LastActivityAt { get; init; }

    /// <summary>
    /// Alias for <see cref="FirstSeenAt"/>. Kept for backward compatibility with existing UI.
    /// </summary>
    public DateTime CreatedAt => FirstSeenAt;

    /// <summary>
    /// When the session expires (latest ExpiresAt across the chain — the live token).
    /// </summary>
    public required DateTime ExpiresAt { get; init; }

    /// <summary>
    /// Whether the session has been revoked (live token state).
    /// </summary>
    public required bool IsRevoked { get; init; }

    /// <summary>
    /// When the session was revoked, if applicable.
    /// </summary>
    public DateTime? RevokedAt { get; init; }

    /// <summary>
    /// Whether the session is currently active (not revoked and not expired).
    /// </summary>
    public required bool IsActive { get; init; }

    /// <summary>
    /// Whether this session belongs to the caller's current browser login.
    /// </summary>
    public required bool IsCurrentSession { get; init; }

    /// <summary>
    /// Whether the session has expired.
    /// </summary>
    public required bool IsExpired { get; init; }
}
