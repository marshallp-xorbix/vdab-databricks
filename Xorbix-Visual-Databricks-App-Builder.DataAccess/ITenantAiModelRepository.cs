using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for tenant-scoped AI model configurations.
/// </summary>
public interface ITenantAiModelRepository
{
    /// <summary>Gets a tenant AI model by id scoped to the tenant.</summary>
    Task<TenantAiModel?> GetByIdForTenantAsync(int tenantAiModelId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Lists non-deleted tenant AI models for a tenant.</summary>
    Task<IReadOnlyList<TenantAiModel>> ListByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Creates a tenant AI model with encrypted access token.</summary>
    Task<TenantAiModel> CreateAsync(TenantAiModel model, CancellationToken cancellationToken = default);

    /// <summary>Updates a tenant AI model with optional access token rotation.</summary>
    Task UpdateAsync(TenantAiModel model, CancellationToken cancellationToken = default);

    /// <summary>Soft-deletes a tenant AI model.</summary>
    Task<bool> SoftDeleteAsync(int tenantAiModelId, Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default);

    /// <summary>Checks whether a display name is already used within the tenant.</summary>
    Task<bool> DisplayNameExistsAsync(Guid tenantId, string displayName, int? excludeModelId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently removes AI models for a tenant purge: rows with the tenant id and/or
    /// rows referencing the tenant's connections (<c>DatabricksConnectionId</c> is Restrict).
    /// </summary>
    Task<int> HardDeleteForTenantPurgeAsync(
        Guid tenantId,
        IReadOnlyCollection<int> connectionIds,
        CancellationToken cancellationToken = default);

    /// <summary>Permanently removes every AI model row that references one of the given Databricks connections.</summary>
    Task<int> HardDeleteByConnectionIdsAsync(IReadOnlyCollection<int> connectionIds, CancellationToken cancellationToken = default);
}
