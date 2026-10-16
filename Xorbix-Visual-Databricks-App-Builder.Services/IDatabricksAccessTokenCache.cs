using Microsoft.Extensions.Caching.Hybrid;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides encrypted cache operations for Databricks access tokens.
/// </summary>
public interface IDatabricksAccessTokenCache
{
    /// <summary>
    /// Gets a token from cache if present, or creates and stores one using the provided factory.
    /// </summary>
    /// <param name="userId">The authenticated user identifier.</param>
    /// <param name="workspaceConnectionId">The Databricks workspace connection identifier.</param>
    /// <param name="factory">Factory used to produce a token when cache is missed.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The decrypted access token when available; otherwise <c>null</c>.</returns>
    Task<string?> GetOrCreateAsync(
        Guid userId,
        int workspaceConnectionId,
        int? accessTokenTtlMinutes,
        Func<CancellationToken, Task<string?>> factory,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Stores a token in cache with the configured TTL.
    /// </summary>
    /// <param name="userId">The authenticated user identifier.</param>
    /// <param name="workspaceConnectionId">The Databricks workspace connection identifier.</param>
    /// <param name="accessToken">The plaintext access token to cache.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task SetAsync(
        Guid userId,
        int workspaceConnectionId,
        int? accessTokenTtlMinutes,
        string accessToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a cached token for the given user and workspace.
    /// </summary>
    /// <param name="userId">The authenticated user identifier.</param>
    /// <param name="workspaceConnectionId">The Databricks workspace connection identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task RemoveAsync(Guid userId, int workspaceConnectionId, CancellationToken cancellationToken = default);
}
