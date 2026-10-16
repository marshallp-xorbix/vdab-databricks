using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    /// <summary>
    /// Provides data access operations for per-user Databricks refresh tokens.
    /// </summary>
    public interface IDatabricksUserTokenRepository
    {
        /// <summary>
        /// Retrieves a user's token for a specific workspace connection.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <param name="workspaceConnectionId">The ID of the workspace connection.</param>
        /// <returns>
        /// The <see cref="DatabricksUserToken"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<DatabricksUserToken?> GetByUserAndWorkspaceAsync(Guid userId, int workspaceConnectionId);

        /// <summary>
        /// Retrieves all tokens for a specific user across all workspaces.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <returns>An enumerable collection of <see cref="DatabricksUserToken"/> objects.</returns>
        Task<IEnumerable<DatabricksUserToken>> GetByUserAsync(Guid userId);

        /// <summary>
        /// Inserts a new token or updates an existing one for a user and workspace combination.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <param name="workspaceConnectionId">The ID of the workspace connection.</param>
        /// <param name="refreshToken">The refresh token to store (will be encrypted).</param>
        /// <param name="expiresAt">When the refresh token expires.</param>
        /// <returns>The upserted <see cref="DatabricksUserToken"/> entity.</returns>
        Task<DatabricksUserToken> UpsertAsync(Guid userId, int workspaceConnectionId, string refreshToken, DateTime? expiresAt);

        /// <summary>
        /// Revokes a user's token for a specific workspace by setting the RevokedAt timestamp.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <param name="workspaceConnectionId">The ID of the workspace connection.</param>
        /// <param name="cancellationToken">A cancellation token.</param>
        /// <returns>True if the token was found and revoked; otherwise false.</returns>
        Task<bool> RevokeAsync(
            Guid userId,
            int workspaceConnectionId,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Rotates a user's token by updating the refresh token and rotation timestamp.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <param name="workspaceConnectionId">The ID of the workspace connection.</param>
        /// <param name="newRefreshToken">The new refresh token to store (will be encrypted).</param>
        /// <param name="expiresAt">When the new refresh token expires.</param>
        /// <returns>The rotated <see cref="DatabricksUserToken"/> entity if found; otherwise null.</returns>
        Task<DatabricksUserToken?> RotateAsync(Guid userId, int workspaceConnectionId, string newRefreshToken, DateTime? expiresAt);

        /// <summary>
        /// Permanently removes every Databricks user token row for the given user.
        /// </summary>
        Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    }
}
