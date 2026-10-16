using FluentResults; 
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AppComponent;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services
{
    public interface IAppComponentService
    {
        // CRUD Operations

        /// <summary>
        /// Retrieves all app components by the app ID.
        /// </summary>
        /// <param name="appId">The ID of the app to retrieve the components for.</param>
        /// <returns>A Result containing an IEnumerable of AppComponentDto if found; otherwise an empty enumerable.</returns>
        Task<Result<IEnumerable<AppComponentDto>>> GetAppComponentsByAppIdAsync(int appId);

        /// <summary>
        /// Retrieves all app components by the app ID, grouped by context (page_{id}, modal_{id}).
        /// </summary>
        /// <param name="appId">The ID of the app to retrieve the components for.</param>
        /// <returns>A Result containing a Dictionary of context names to lists of AppComponentDto.</returns>
        Task<Result<Dictionary<string, List<AppComponentDto>>>> GetComponentsByContextAsync(int appId, Guid tenantId);

        /// <summary>
        /// Adds a new app component.
        /// </summary>
        /// <param name="appComponent">The app component to add.</param>
        /// <returns>A Result indicating success or failure.</returns>
        Task<Result> AddAppComponentAsync(AppComponent appComponent);

        /// <summary>
        /// Updates an existing app component.
        /// </summary>
        /// <param name="appComponent">The app component to update.</param>
        /// <returns>A Result indicating success or failure.</returns>
        Task<Result> UpdateAppComponentAsync(AppComponent appComponent);

        /// <summary>
        /// Deletes an app component by its ID.
        /// </summary>
        /// <param name="appComponentId">The ID of the app component to delete.</param>
        /// <param name="actingUserId">The authenticated user; used when touching parent app audit fields.</param>
        /// <returns>A Result indicating success or failure.</returns>
        Task<Result> DeleteAppComponentAsync(int appComponentId, Guid actingUserId, Guid tenantId);

        /// <summary>
        /// Upserts an app component with validation.
        /// </summary>
        /// <param name="appId">The ID of the app this component belongs to.</param>
        /// <param name="request">The upsert request.</param>
        /// <param name="actingUserId">The authenticated user; used when touching parent app audit fields.</param>
        /// <returns>A Result containing the saved AppComponentDto.</returns>
        Task<Result<AppComponentDto>> UpsertAppComponentAsync(int appId, UpsertAppComponentRequest request, Guid actingUserId, Guid tenantId);

        /// <summary>
        /// Upserts multiple app components in batch.
        /// </summary>
        /// <param name="appId">The ID of the app these components belong to.</param>
        /// <param name="requests">The upsert requests.</param>
        /// <param name="actingUserId">The authenticated user; used when touching parent app audit fields once after a successful batch.</param>
        /// <returns>A Result containing the saved AppComponentDto collection.</returns>
        Task<Result<IEnumerable<AppComponentDto>>> UpsertAppComponentsBatchAsync(int appId, IEnumerable<UpsertAppComponentRequest> requests, Guid actingUserId, Guid tenantId);
    }
}