using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository interface for managing refresh tokens.
/// </summary>
public interface IRefreshTokenRepository
{
    /// <summary>
    /// Creates a new refresh token.
    /// </summary>
    /// <param name="refreshToken">The refresh token to create.</param>
    /// <returns>The created refresh token.</returns>
    Task<RefreshToken> CreateAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a refresh token by its token value.
    /// </summary>
    /// <param name="token">The token value.</param>
    /// <returns>The refresh token if found, otherwise null.</returns>
    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a refresh token by its ID.
    /// </summary>
    /// <param name="id">The token ID.</param>
    /// <returns>The refresh token if found, otherwise null.</returns>
    Task<RefreshToken?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the fields needed to revoke a session by live refresh-token ID, without loading the User navigation.
    /// </summary>
    /// <param name="id">The live refresh token ID.</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>Revoke info when found; otherwise null.</returns>
    Task<RefreshTokenRevokeInfo?> GetRevokeInfoByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes a refresh token.
    /// </summary>
    /// <param name="token">The token value to revoke.</param>
    /// <returns>True if successful, otherwise false.</returns>
    Task<bool> RevokeAsync(string token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes all active refresh tokens for a user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <returns>The number of tokens revoked.</returns>
    Task<int> RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes all active refresh tokens for a user that were minted under <paramref name="tenantId"/>.
    /// Tokens with a null <c>TenantId</c> (legacy) are left untouched.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="tenantId">The tenant whose sessions should be revoked.</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>The number of tokens revoked.</returns>
    Task<int> RevokeAllForUserAndTenantAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an existing refresh token.
    /// </summary>
    /// <param name="refreshToken">The refresh token to update.</param>
    /// <returns>The updated refresh token.</returns>
    Task<RefreshToken> UpdateAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes a specific refresh token by ID.
    /// </summary>
    /// <param name="tokenId">The token ID to revoke.</param>
    /// <returns>True if successful, otherwise false.</returns>
    Task<bool> RevokeByIdAsync(int tokenId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets refresh tokens for a user that are missing geolocation data but have an IP address.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="tokenIds">The specific token IDs to check.</param>
    /// <returns>Tokens missing geolocation data.</returns>
    Task<List<RefreshToken>> GetTokensMissingGeoDataAsync(Guid userId, List<int> tokenIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically marks a refresh token as revoked only if it is currently not revoked.
    /// Returns true if this caller "won" the claim (rows-affected == 1) and is therefore
    /// responsible for minting the replacement; returns false if another caller already
    /// rotated the token (the loser should fall back to the existing replacement).
    /// </summary>
    /// <param name="tokenId">The token ID to claim for rotation.</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>True if claim succeeded, false if already revoked.</returns>
    Task<bool> TryClaimRotationAsync(int tokenId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes every refresh token belonging to a single session (rotation chain).
    /// Used by reuse-detection when an already-revoked token is presented.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="sessionId">The session identifier shared by the chain.</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>The number of tokens revoked.</returns>
    Task<int> RevokeSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns whether the user has at least one active (non-revoked, non-expired) refresh token
    /// in the given session rotation chain.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="sessionId">The session identifier.</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>True when the session is still active.</returns>
    Task<bool> HasActiveSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets paginated grouped sessions for a user. Each result represents one rotation chain
    /// (one login) summarised as: earliest CreatedAt, latest ExpiresAt, plus device/location
    /// data taken from the latest (live) token in the chain.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="skip">The number of sessions to skip.</param>
    /// <param name="take">The number of sessions to return.</param>
    /// <param name="activeOnly">When true, returns only sessions that contain a live (non-revoked, non-expired) token.</param>
    /// <param name="tenantId">When set, only sessions minted under this tenant are returned (null-tenant legacy rows excluded).</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>The grouped sessions and total count.</returns>
    Task<(List<GroupedSessionRow> Sessions, int TotalCount)> GetPaginatedGroupedSessionsAsync(
        Guid userId,
        int skip,
        int take,
        bool activeOnly,
        Guid? tenantId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently removes every refresh token row for the given user.
    /// Clears self-referencing replacement links first to avoid NoAction FK conflicts.
    /// </summary>
    Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Lightweight projection used when deciding whether to revoke a session.
/// </summary>
public sealed class RefreshTokenRevokeInfo
{
    /// <summary>Live refresh token primary key.</summary>
    public required int Id { get; init; }

    /// <summary>Owning user ID.</summary>
    public required Guid UserId { get; init; }

    /// <summary>Session rotation-chain identifier.</summary>
    public required Guid SessionId { get; init; }

    /// <summary>Tenant the session was minted under, if known.</summary>
    public Guid? TenantId { get; init; }

    /// <summary>Whether this live token is already revoked.</summary>
    public required bool IsRevoked { get; init; }
}

/// <summary>
/// Aggregated view of a single rotation chain (one user login).
/// </summary>
public sealed class GroupedSessionRow
{
    /// <summary>The session identifier shared by all tokens in the chain.</summary>
    public required Guid SessionId { get; init; }

    /// <summary>The ID of the live (or most recent) token in the chain. Used as the action target for revoke.</summary>
    public required int LiveTokenId { get; init; }

    /// <summary>Earliest CreatedAt across the chain (the original login time).</summary>
    public required DateTime FirstSeenAt { get; init; }

    /// <summary>Latest CreatedAt across the chain (most recent rotation).</summary>
    public required DateTime LastActivityAt { get; init; }

    /// <summary>Latest ExpiresAt across the chain.</summary>
    public required DateTime ExpiresAt { get; init; }

    /// <summary>Whether the live token is revoked.</summary>
    public required bool IsRevoked { get; init; }

    /// <summary>Revocation timestamp of the live token, if any.</summary>
    public DateTime? RevokedAt { get; init; }

    /// <summary>Device and location fields taken from the live token.</summary>
    public string? IpAddress { get; init; }

    public string? UserAgent { get; init; }

    public string? City { get; init; }

    public string? Country { get; init; }

    public string? Region { get; init; }
}
