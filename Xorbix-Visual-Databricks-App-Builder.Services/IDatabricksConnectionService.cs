using FluentResults; // Need this using statement
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services
{
    public interface IDatabricksConnectionService
    {
        // CRUD Operations

        /// <summary>
        /// Retrieves a Databricks connection by its workspace URL.
        /// </summary>
        /// <param name="workspaceUrl">The unique URL of the Databricks workspace.</param>
        /// <param name="tenantId">Authenticated tenant scope.</param>
        /// <returns>A Result containing the connection DTO, or null if not found.</returns>
        Task<Result<DatabricksConnectionDto?>> GetConnectionByWorkspaceAsync(string workspaceUrl, Guid tenantId);

        /// <summary>
        /// Retrieves all Databricks connections for a given tenant.
        /// </summary>
        /// <param name="tenantId">The tenant ID to filter by.</param>
        /// <returns>A Result containing an enumerable collection of connection DTOs on success.</returns>
        Task<Result<IEnumerable<DatabricksConnectionDto>>> GetConnectionsByTenantIdAsync(Guid tenantId);

        /// <summary>
        /// Creates a new Databricks workspace connection for the given tenant.
        /// Rejects duplicate workspace URLs within the same tenant.
        /// </summary>
        /// <param name="request">Connection details to insert.</param>
        /// <param name="ownerId">The authenticated user who owns the new connection.</param>
        /// <param name="tenantId">The tenant that owns the new connection.</param>
        /// <returns>A Result containing the created connection DTO on success.</returns>
        Task<Result<DatabricksConnectionDto>> CreateConnectionAsync(
            CreateDatabricksConnectionRequest request,
            Guid ownerId,
            Guid tenantId);

        /// <summary>
        /// Updates an existing Databricks workspace connection by primary key.
        /// The connection owner is preserved unless changed through a dedicated ownership transfer flow.
        /// </summary>
        /// <param name="connectionId">Primary key of the connection to update.</param>
        /// <param name="request">Updated connection fields.</param>
        /// <param name="tenantId">Tenant scope used to authorize the update.</param>
        /// <returns>A Result containing the updated connection DTO on success.</returns>
        Task<Result<DatabricksConnectionDto>> UpdateConnectionAsync(
            int connectionId,
            UpdateDatabricksConnectionRequest request,
            Guid tenantId);

        /// <summary>
        /// Deletes a Databricks connection by its ID. Only the connection owner or a tenant administrator may delete it.
        /// </summary>
        /// <param name="id">The primary key ID of the connection to delete.</param>
        /// <param name="tenantId">Authenticated tenant scope.</param>
        /// <param name="userId">The caller's user ID, used for owner-based authorization.</param>
        /// <param name="isTenantAdmin">Whether the caller is a tenant administrator.</param>
        /// <returns>A Result indicating success or failure.</returns>
        Task<Result> DeleteConnectionAsync(int id, Guid tenantId, Guid userId, bool isTenantAdmin);

        // Credential and Token Operations

        /// <summary>
        /// Retrieves the Client ID and Client Secret for a given workspace.
        /// </summary>
        /// <param name="workspaceUrl">The unique URL of the Databricks workspace.</param>
        /// <param name="tenantId">Authenticated tenant scope.</param>
        /// <returns>A Result containing a tuple of (ClientId, ClientSecret), or null if not found.</returns>
        Task<Result<(string ClientId, string ClientSecret)?>> GetCredentialsAsync(string workspaceUrl, Guid tenantId);

        /// <summary>
        /// Updates the refresh token for a specific user and workspace connection.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <param name="workspaceConnectionId">The ID of the workspace connection.</param>
        /// <param name="refreshToken">The refresh token to store.</param>
        /// <param name="expiresAt">When the refresh token expires.</param>
        /// <returns>A Result indicating success or failure.</returns>
        Task<Result> AddRefreshTokenAsync(Guid userId, int workspaceConnectionId, string refreshToken, DateTime? expiresAt, Guid tenantId);

        /// <summary>
        /// Exchanges an OAuth authorization code for access and refresh tokens with Databricks.
        /// </summary>
        /// <param name="request">OAuth code exchange request details.</param>
        /// <param name="tenantId">Tenant scope used to resolve the workspace connection.</param>
        /// <returns>A Result containing the raw token response payload.</returns>
        Task<Result<string>> ExchangeTokenAsync(OAuthCodeExchangeRequest request, Guid tenantId);

        /// <summary>
        /// Refreshes an expired access token using the stored refresh token for a specific user.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <param name="workspaceConnectionId">The ID of the workspace connection.</param>
        /// <returns>A Result containing the new access token.</returns>
        Task<Result<string>> RefreshAccessTokenAsync(Guid userId, int workspaceConnectionId, Guid tenantId);

        /// <summary>
        /// Retrieves all Databricks connections for a given tenant, enriched with the current
        /// user's authorization status (has a valid, non-expired, non-revoked refresh token).
        /// </summary>
        /// <param name="tenantId">The tenant ID to filter connections by.</param>
        /// <param name="userId">The ID of the current user whose token status is evaluated.</param>
        /// <returns>A Result containing an IEnumerable of <see cref="DatabricksConnectionStatusDto"/>.</returns>
        Task<Result<IEnumerable<DatabricksConnectionStatusDto>>> GetConnectionsWithAuthStatusAsync(Guid tenantId, Guid userId);

        /// <summary>
        /// Retrieves a valid access token for a specific user, refreshing it when missing or expired.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <param name="workspaceConnectionId">The ID of the workspace connection.</param>
        /// <returns>A Result containing a valid access token.</returns>
        Task<Result<string>> GetValidAccessTokenAsync(Guid userId, int workspaceConnectionId, Guid tenantId);

        /// <summary>
        /// Disconnects a user from a workspace by revoking their refresh token and clearing the cached access token.
        /// </summary>
        /// <param name="userId">The ID of the user.</param>
        /// <param name="workspaceConnectionId">The ID of the workspace connection to disconnect.</param>
        /// <returns>A Result indicating success or failure.</returns>
        Task<Result> DisconnectWorkspaceAsync(Guid userId, int workspaceConnectionId, Guid tenantId);

    }
}