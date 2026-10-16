using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services
{
    public interface IAppService
    {
        // CRUD Operations

        /// <summary>
        /// Retrieves an app by its ID.
        /// </summary>
        /// <param name="appId">The ID of the app to retrieve.</param>
        /// <param name="tenantId">The tenant ID to authorize against.</param>
        /// <returns>A Result containing the AppDto, or null if not found.</returns>
        Task<Result<AppDto?>> GetAppByIdAsync(int appId, Guid tenantId);

        /// <summary>
        /// Retrieves all apps for a given tenant ID.
        /// </summary>
        /// <param name="tenantId">The tenant ID to filter by.</param>
        /// <returns>A Result containing an IEnumerable of AppDto if found; otherwise an empty enumerable.</returns>
        Task<Result<IEnumerable<AppDto>>> GetAppsByTenantIdAsync(Guid tenantId);

        /// <summary>
        /// Creates a new VDAB app with Databricks app linkage strategy.
        /// </summary>
        /// <param name="request">Create app request payload.</param>
        /// <param name="ownerId">Authenticated user ID who owns the app.</param>
        /// <param name="tenantId">Authenticated tenant ID.</param>
        /// <returns>A Result containing the created AppDto.</returns>
        Task<Result<AppDto>> CreateAppAsync(CreateAppRequest request, Guid ownerId, Guid tenantId);

        /// <summary>
        /// Creates a new app.
        /// </summary>
        /// <param name="app">The app to create.</param>
        /// <returns>A Result containing the created AppDto.</returns>
        Task<Result<AppDto>> CreateAppAsync(App app);

        /// <summary>
        /// Updates an existing app.
        /// </summary>
        /// <param name="appId">The ID of the app to update.</param>
        /// <param name="request">The update request payload.</param>
        /// <param name="userId">The user ID updating the app.</param>
        /// <param name="tenantId">The tenant ID to authorize against.</param>
        /// <returns>A Result indicating success or failure.</returns>
        Task<Result> UpdateAppAsync(int appId, UpdateAppRequest request, Guid userId, Guid tenantId);

        /// <summary>
        /// Deletes an app by its ID. Only the app owner or a tenant administrator may delete it.
        /// </summary>
        /// <param name="appId">The ID of the app to delete.</param>
        /// <param name="tenantId">The tenant ID to authorize against.</param>
        /// <param name="userId">The caller's user ID, used for owner-based authorization.</param>
        /// <param name="isTenantAdmin">Whether the caller is a tenant administrator.</param>
        /// <returns>A Result indicating success or failure.</returns>
        Task<Result> DeleteAppAsync(int appId, Guid tenantId, Guid userId, bool isTenantAdmin);


        Task<Result<AppDto?>> GetAppByNameAsync(string appName, Guid tenantId);
    }
}