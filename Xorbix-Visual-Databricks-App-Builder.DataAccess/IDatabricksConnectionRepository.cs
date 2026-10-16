using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    /// <summary>
    /// Provides data access operations for Databricks connection configurations.
    /// </summary>
    public interface IDatabricksConnectionRepository
    {
        /// <summary>
        /// Retrieves a Databricks connection by its ID.
        /// </summary>
        /// <param name="id">The ID of the connection to retrieve.</param>
        /// <returns>
        /// The <see cref="DatabricksConnection"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<DatabricksConnection?> GetByIdAsync(int id);

        /// <summary>
        /// Retrieves a non-deleted Databricks connection by ID scoped to a tenant.
        /// </summary>
        /// <param name="connectionId">The connection ID to retrieve.</param>
        /// <param name="tenantId">The tenant ID to scope the lookup.</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns>The matching connection when found; otherwise <c>null</c>.</returns>
        Task<DatabricksConnection?> GetByIdForTenantAsync(
            int connectionId,
            Guid tenantId,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Retrieves the full Databricks connection entity for a given workspace URL.
        /// </summary>
        /// <param name="workspaceUrl">The Databricks workspace URL to search.</param>
        /// <returns>
        /// The <see cref="DatabricksConnection"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<DatabricksConnection?> GetByWorkspaceUrlAsync(string workspaceUrl);

        /// <summary>
        /// Retrieves a non-deleted Databricks connection for a tenant by normalized workspace URL.
        /// </summary>
        /// <param name="tenantId">The tenant ID to scope the lookup.</param>
        /// <param name="workspaceUrl">The normalized Databricks workspace URL.</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns>The matching connection when found; otherwise <c>null</c>.</returns>
        Task<DatabricksConnection?> GetByTenantAndWorkspaceUrlAsync(
            Guid tenantId,
            string workspaceUrl,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Determines whether a non-deleted connection already exists for the tenant and workspace URL.
        /// </summary>
        /// <param name="tenantId">The tenant ID to scope the check.</param>
        /// <param name="workspaceUrl">The normalized Databricks workspace URL.</param>
        /// <param name="excludeConnectionId">Optional connection ID to exclude (for updates).</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns><c>true</c> when a duplicate exists within the tenant.</returns>
        Task<bool> ExistsByTenantAndWorkspaceUrlAsync(
            Guid tenantId,
            string workspaceUrl,
            int? excludeConnectionId = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Retrieves all Databricks connection configurations.
        /// </summary>
        /// <returns>An enumerable collection of <see cref="DatabricksConnection"/> objects.</returns>
        Task<IEnumerable<DatabricksConnection>> GetAllAsync();

        /// <summary>
        /// Adds a new Databricks connection configuration to the data store.
        /// </summary>
        /// <param name="connection">The Databricks connection entity to add.</param>
        Task AddAsync(DatabricksConnection connection);

        /// <summary>
        /// Updates an existing Databricks connection configuration.
        /// </summary>
        /// <param name="connection">The Databricks connection entity to update.</param>
        Task UpdateAsync(DatabricksConnection connection);

        /// <summary>
        /// Deletes a Databricks connection configuration.
        /// </summary>
        /// <param name="connection">The Databricks connection entity to delete.</param>
        Task DeleteAsync(DatabricksConnection connection);

        /// <summary>
        /// Retrieves all Databricks connection configurations owned by a specific user.
        /// </summary>
        /// <param name="ownerId">The ID of the owning user.</param>
        /// <returns>An enumerable collection of the user's <see cref="DatabricksConnection"/> entries.</returns>
        Task<IEnumerable<DatabricksConnection>> GetByUserAsync(Guid ownerId);

        /// <summary>
        /// Retrieves all Databricks connection configurations for a given tenant.
        /// </summary>
        /// <param name="tenantId">The tenant ID to filter by.</param>
        /// <param name="cancellationToken">A cancellation token.</param>
        /// <returns>An enumerable collection of the tenant's <see cref="DatabricksConnection"/> entries.</returns>
        Task<IEnumerable<DatabricksConnection>> GetByTenantIdAsync(
            Guid tenantId,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Counts non-deleted Databricks workspace connections across all tenants.
        /// </summary>
        Task<int> CountActiveWorkspacesAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Soft-deletes every non-deleted connection owned by the given tenant.
        /// </summary>
        Task<int> SoftDeleteByTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Permanently removes every connection row for the given tenant.
        /// </summary>
        Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Returns the primary keys of every connection for the given tenant (including soft-deleted).
        /// </summary>
        Task<IReadOnlyList<int>> GetIdsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Returns the primary keys of every connection owned by the given user.
        /// </summary>
        Task<IReadOnlyList<int>> GetIdsByOwnerAsync(Guid ownerId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Permanently removes every connection row owned by the given user.
        /// </summary>
        Task<int> HardDeleteByOwnerAsync(Guid ownerId, CancellationToken cancellationToken = default);
    }
}
