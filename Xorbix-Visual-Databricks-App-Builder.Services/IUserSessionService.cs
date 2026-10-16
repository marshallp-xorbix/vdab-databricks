using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing user sessions and session metadata.
/// </summary>
public interface IUserSessionService
{
    /// <summary>
    /// Gets paginated user sessions grouped by login (rotation chain) with parsed device/location info.
    /// Each result row represents one login — earliest CreatedAt, latest ExpiresAt — rather than
    /// one row per refresh-token rotation. Backfills missing geolocation data when possible.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="skip">Number of sessions to skip.</param>
    /// <param name="take">Number of sessions to return.</param>
    /// <param name="activeOnly">When true, only sessions with at least one live (non-revoked, non-expired) token are returned.</param>
    /// <param name="currentSessionId">When set, marks the matching session as the caller's current session.</param>
    /// <param name="tenantId">When set, only sessions minted under this tenant are returned.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Paginated sessions response with total count.</returns>
    Task<Result<UserSessionsResponse>> GetUserSessionsAsync(
        Guid userId,
        int skip,
        int take,
        bool activeOnly = true,
        Guid? currentSessionId = null,
        Guid? tenantId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes (terminates) a specific user session by its live refresh-token ID.
    /// </summary>
    /// <param name="userId">The user ID who owns the session.</param>
    /// <param name="sessionId">The live refresh token ID to revoke.</param>
    /// <param name="revokedByUserId">The ID of the admin performing the action.</param>
    /// <param name="callerSessionId">The caller's current session identifier, if known.</param>
    /// <param name="tenantId">When set, the session must belong to this tenant or the revoke fails.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure result indicating whether the caller's session was revoked.</returns>
    Task<Result<RevokeSessionResponse>> RevokeSessionAsync(
        Guid userId,
        int sessionId,
        Guid revokedByUserId,
        Guid? callerSessionId = null,
        Guid? tenantId = null,
        CancellationToken cancellationToken = default);
}
