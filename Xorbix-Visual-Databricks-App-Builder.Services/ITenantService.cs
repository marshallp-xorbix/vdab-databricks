using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing tenant entities and subscription limit enforcement.
/// </summary>
public interface ITenantService
{
    /// <summary>
    /// Retrieves a tenant by its unique identifier.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The tenant entity, or a failure result if not found.</returns>
    Task<Result<Tenant>> GetTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates tenant settings. Only TenantAdmin+ should call this.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="request">The update request containing new values.</param>
    /// <param name="updatedByUserId">The ID of the user performing the update.</param>
    /// <param name="tenant">Optional existing tenant entity to update, to avoid an extra database call if already retrieved by the caller.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The updated tenant entity, or a failure result.</returns>
    Task<Result<Tenant>> UpdateTenantAsync(Guid tenantId, UpdateTenantRequest request, Guid updatedByUserId, Tenant? tenant = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Transfers ownership of a tenant to another active member. The new owner is promoted to
    /// tenant Admin when their current role is below that level; the previous owner's role is left
    /// unchanged. Authorization (only the current owner or a global administrator may transfer)
    /// is enforced by the caller.
    /// </summary>
    /// <param name="tenantId">The tenant whose ownership is being transferred.</param>
    /// <param name="newOwnerUserId">The member who should become the new owner.</param>
    /// <param name="performedByUserId">The user performing the transfer.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The updated tenant entity, or a failure result.</returns>
    Task<Result<Tenant>> TransferOwnershipAsync(Guid tenantId, Guid newOwnerUserId, Guid performedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves the usage dashboard data for a tenant, including current counts versus subscription limits.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Usage statistics DTO, or a failure result if the tenant is not found.</returns>
    Task<Result<TenantUsageStatsDto>> GetUsageDashboardAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates whether the tenant can add another resource of the specified type
    /// without exceeding subscription limits.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier.</param>
    /// <param name="resourceType">The type of resource being added: "User", "App", or "Connection".</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success if within limits; failure with a descriptive error if the limit would be exceeded.</returns>
    Task<Result> ValidateSubscriptionLimitsAsync(Guid tenantId, string resourceType, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a paginated list of all tenants. Intended for Global Administrator use.
    /// </summary>
    /// <param name="skip">Number of records to skip.</param>
    /// <param name="take">Number of records to return.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A paginated response containing tenant DTOs and total count.</returns>
    Task<Result<PaginatedTenantsResponse>> GetAllTenantsAsync(int skip, int take, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new tenant. When <paramref name="isRegistration"/> is true, the creating user
    /// is added as TenantAdmin with this tenant as their default. When false (e.g. global admin),
    /// no membership is created.
    /// </summary>
    /// <param name="request">The create request containing tenant details.</param>
    /// <param name="createdByUserId">The ID of the user creating the tenant.</param>
    /// <param name="isRegistration">Whether this tenant is being created as part of user self-registration.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The created tenant as a DTO, or a failure result.</returns>
    Task<Result<TenantDto>> CreateTenantAsync(CreateTenantRequest request, Guid createdByUserId, bool isRegistration = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new tenant on behalf of a global administrator. Unlike self-registration,
    /// the administrator selects the tenant owner via <see cref="CreateTenantRequest.OwnerId"/>,
    /// and that owner is automatically added as a TenantAdmin member with this tenant as their
    /// default. An owner is required. The tenant create and owner membership are performed
    /// atomically.
    /// </summary>
    /// <param name="request">The create request containing tenant details and the selected owner.</param>
    /// <param name="createdByUserId">The ID of the administrator creating the tenant.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The created tenant as a DTO, or a failure result.</returns>
    Task<Result<TenantDto>> CreateTenantAsAdminAsync(CreateTenantRequest request, Guid createdByUserId, CancellationToken cancellationToken = default);
}
