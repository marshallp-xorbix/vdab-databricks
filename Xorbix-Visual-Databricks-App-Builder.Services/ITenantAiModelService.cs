using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.TenantAiModel;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Manages tenant-scoped AI model configurations for AI Builder.
/// </summary>
public interface ITenantAiModelService
{
    /// <summary>Lists tenant AI models without secrets.</summary>
    Task<Result<IReadOnlyList<TenantAiModelDto>>> GetByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Gets a tenant AI model by id.</summary>
    Task<Result<TenantAiModelDto>> GetByIdAsync(int tenantAiModelId, Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Creates and validates a tenant AI model.</summary>
    Task<Result<TenantAiModelDto>> CreateAsync(
        CreateTenantAiModelRequest request,
        Guid tenantId,
        Guid createdByUserId,
        CancellationToken cancellationToken = default);

    /// <summary>Updates and validates a tenant AI model.</summary>
    Task<Result<TenantAiModelDto>> UpdateAsync(
        int tenantAiModelId,
        UpdateTenantAiModelRequest request,
        Guid tenantId,
        Guid modifiedByUserId,
        CancellationToken cancellationToken = default);

    /// <summary>Soft-deletes a tenant AI model.</summary>
    Task<Result> DeleteAsync(int tenantAiModelId, Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default);
}
