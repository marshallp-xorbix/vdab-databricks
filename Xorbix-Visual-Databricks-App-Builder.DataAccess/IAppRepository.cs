using System.Collections.Generic;
using System.Threading.Tasks;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    /// <summary>
    /// Provides data access operations for apps.
    /// </summary>
    public interface IAppRepository
    {
        /// <summary>
        /// Retrieves the app by its ID.
        /// </summary>
        /// <param name="id">The ID of the app to retrieve.</param>
        /// <returns>
        /// The <see cref="App"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<App?> GetByIdAsync(int id);

        Task<App?> GetByNameAsync(string appName);

        /// <summary>
        /// Retrieves the full App entities for a given owner ID.
        /// </summary>
        /// <param name="ownerId">The ID of the owner to search.</param>
        /// <returns>
        /// An enumerable collection of <see cref="App"/> entities if found; otherwise an empty enumerable.
        /// </returns>
        Task<IEnumerable<App>> GetByOwnerIdAsync(Guid ownerId);

        /// <summary>
        /// Retrieves all non-deleted App entities for a given tenant ID.
        /// </summary>
        /// <param name="tenantId">The tenant ID to filter by.</param>
        /// <returns>
        /// An enumerable collection of <see cref="App"/> entities if found; otherwise an empty enumerable.
        /// </returns>
        Task<IEnumerable<App>> GetByTenantIdAsync(Guid tenantId);

        /// <summary>
        /// Retrieves all apps from the data store.
        /// </summary>
        /// <returns>
        /// An enumerable collection of <see cref="App"/> entities.
        /// </returns>
        Task <IEnumerable<App>> GetAllAsync();

        /// <summary>
        /// Adds a new app to the data store.
        /// </summary>
        /// <param name="app">The app entity to add.</param>
        Task AddAsync(App app);

        /// <summary>
        /// Updates an existing app in the data store.
        /// </summary>
        /// <param name="app">The app entity to update.</param>
        Task UpdateAsync(App app);

        /// <summary>
        /// Deletes an app from the data store.
        /// </summary>
        /// <param name="app">The app entity to delete.</param>
        Task DeleteAsync(App app);

        /// <summary>
        /// Sets the app's <c>ModifiedOn</c> to UTC now and <c>ModifiedBy</c> if the app exists and is not soft-deleted.
        /// </summary>
        /// <param name="appId">The app primary key.</param>
        /// <param name="modifiedBy">The user who performed the change.</param>
        Task TouchModifiedUtcAsync(int appId, Guid modifiedBy);

        /// <summary>
        /// Counts non-deleted apps across all tenants.
        /// </summary>
        Task<int> CountActiveAppsAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Soft-deletes every non-deleted app owned by the given tenant.
        /// </summary>
        Task<int> SoftDeleteByTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Permanently removes apps for a tenant purge: rows with the tenant id and/or
        /// rows referencing the tenant's workspace connections (<c>WorkspaceConnectionId</c> is Restrict).
        /// </summary>
        Task<int> HardDeleteForTenantPurgeAsync(
            Guid tenantId,
            IReadOnlyCollection<int> connectionIds,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Permanently removes apps for a user purge: rows owned by the user and/or
        /// rows referencing the user's workspace connections (<c>WorkspaceConnectionId</c> is Restrict).
        /// </summary>
        Task<int> HardDeleteForUserPurgeAsync(
            Guid ownerId,
            IReadOnlyCollection<int> connectionIds,
            CancellationToken cancellationToken = default);
    }
}
