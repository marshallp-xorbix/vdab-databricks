using System.Collections.Generic;
using System.Threading.Tasks;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    /// <summary>
    /// Provides data access operations for App components.
    /// </summary>
    public interface IAppComponentRepository
    {
        /// <summary>
        /// Retrieves an app component by its ID.
        /// </summary>
        /// <param name="id">The ID of the app component to retrieve.</param>
        /// <returns>
        /// The <see cref="AppComponent"/> entity if found; otherwise <c>null</c>.
        /// </returns>
        Task<AppComponent?> GetByIdAsync(int id);

        /// <summary>
        /// Retrieves the app components by the app ID.
        /// </summary>
        /// <param name="appId">The ID of the app to retrieve the components for.</param>
        /// <returns>
        /// An enumerable collection of <see cref="AppComponent"/> entities if found; otherwise an empty enumerable.
        /// </returns>
        Task<IEnumerable<AppComponent>> GetByAppIdAsync(int appId);

        /// <summary>
        /// Retrieves the app components for a set of app IDs in a single query.
        /// </summary>
        /// <param name="appIds">The IDs of the apps to retrieve the components for.</param>
        /// <returns>
        /// An enumerable collection of <see cref="AppComponent"/> entities for the given apps;
        /// otherwise an empty enumerable.
        /// </returns>
        Task<IEnumerable<AppComponent>> GetByAppIdsAsync(IEnumerable<int> appIds);

        /// <summary>
        /// Adds a new app component to the data store.
        /// </summary>
        /// <param name="appComponent">The app component entity to add.</param>
        Task AddAsync(AppComponent appComponent);

        /// <summary>
        /// Updates an existing app component in the data store.
        /// </summary>
        /// <param name="appComponent">The app component entity to update.</param>
        Task UpdateAsync(AppComponent appComponent);

        /// <summary>
        /// Deletes an app component from the data store.
        /// </summary>
        /// <param name="appComponent">The app component entity to delete.</param>
        Task DeleteAsync(AppComponent appComponent);

        /// <summary>
        /// Upserts an app component. If PkId > 0 and exists, updates; otherwise inserts.
        /// </summary>
        /// <param name="appComponent">The app component entity to upsert.</param>
        /// <returns>The saved entity with PkId populated.</returns>
        Task<AppComponent> UpsertAsync(AppComponent appComponent);
    }
}
