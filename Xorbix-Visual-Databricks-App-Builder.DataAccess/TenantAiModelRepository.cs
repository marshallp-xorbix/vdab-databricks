using System.Transactions;
using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <inheritdoc/>
public class TenantAiModelRepository(
    ApplicationDbContext _context,
    IEncryptionHelper _encryption,
    IUserTenantPreferenceRepository _preferenceRepository) : ITenantAiModelRepository
{
    /// <inheritdoc/>
    public async Task<TenantAiModel?> GetByIdForTenantAsync(int tenantAiModelId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        TenantAiModel? model = await _context.TenantAiModels
            .AsNoTracking()
            .Include(m => m.DatabricksConnection)
            .FirstOrDefaultAsync(
                m => m.TenantAiModelId == tenantAiModelId
                    && m.TenantId == tenantId
                    && m.DeletedOn == null,
                cancellationToken);

        if (model is not null && !string.IsNullOrEmpty(model.AccessToken))
        {
            model.AccessToken = _encryption.Decrypt(model.AccessToken);
        }

        return model;
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<TenantAiModel>> ListByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.TenantAiModels
            .AsNoTracking()
            .Include(m => m.DatabricksConnection)
            .Where(m => m.TenantId == tenantId && m.DeletedOn == null)
            .OrderBy(m => m.DisplayName)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<TenantAiModel> CreateAsync(TenantAiModel model, CancellationToken cancellationToken = default)
    {
        model.CreatedOn = DateTime.UtcNow;
        model.AccessToken = _encryption.Encrypt(model.AccessToken);
        model.DatabricksConnection = null;
        model.Tenant = null;

        _context.TenantAiModels.Add(model);
        await _context.SaveChangesAsync(cancellationToken);

        model.AccessToken = _encryption.Decrypt(model.AccessToken);
        return model;
    }

    /// <inheritdoc/>
    public async Task UpdateAsync(TenantAiModel model, CancellationToken cancellationToken = default)
    {
        model.ModifiedOn = DateTime.UtcNow;
        model.AccessToken = _encryption.Encrypt(model.AccessToken);
        model.DatabricksConnection = null;
        model.Tenant = null;
        _context.TenantAiModels.Update(model);
        await _context.SaveChangesAsync(cancellationToken);
        model.AccessToken = _encryption.Decrypt(model.AccessToken);
    }

    /// <inheritdoc/>
    public async Task<bool> SoftDeleteAsync(int tenantAiModelId, Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default)
    {
        TenantAiModel? model = await _context.TenantAiModels
            .FirstOrDefaultAsync(
                m => m.TenantAiModelId == tenantAiModelId
                    && m.TenantId == tenantId
                    && m.DeletedOn == null,
                cancellationToken);

        if (model is null)
        {
            return false;
        }

        DateTime now = DateTime.UtcNow;
        model.DeletedOn = now;
        model.DeletedBy = deletedByUserId;
        model.ModifiedOn = now;
        model.ModifiedBy = deletedByUserId;

        using TransactionScope transaction = new(
            TransactionScopeOption.Required,
            TransactionScopeAsyncFlowOption.Enabled);

        await _preferenceRepository.ClearIntPreferenceForTenantAsync(
            tenantId,
            UserTenantPreferenceKeys.AiBuilderSelectedModelId,
            tenantAiModelId,
            cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);
        transaction.Complete();
        return true;
    }

    /// <inheritdoc/>
    public async Task<bool> DisplayNameExistsAsync(
        Guid tenantId,
        string displayName,
        int? excludeModelId = null,
        CancellationToken cancellationToken = default)
    {
        string normalized = displayName.Trim();
        return await _context.TenantAiModels.AnyAsync(
            m => m.TenantId == tenantId
                && m.DeletedOn == null
                && m.DisplayName == normalized
                && (!excludeModelId.HasValue || m.TenantAiModelId != excludeModelId.Value),
            cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteForTenantPurgeAsync(
        Guid tenantId,
        IReadOnlyCollection<int> connectionIds,
        CancellationToken cancellationToken = default)
    {
        if (connectionIds.Count == 0)
        {
            return await _context.TenantAiModels
                .Where(m => m.TenantId == tenantId)
                .ExecuteDeleteAsync(cancellationToken);
        }

        return await _context.TenantAiModels
            .Where(m => m.TenantId == tenantId || connectionIds.Contains(m.DatabricksConnectionId))
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByConnectionIdsAsync(
        IReadOnlyCollection<int> connectionIds,
        CancellationToken cancellationToken = default)
    {
        if (connectionIds.Count == 0)
        {
            return 0;
        }

        return await _context.TenantAiModels
            .Where(m => connectionIds.Contains(m.DatabricksConnectionId))
            .ExecuteDeleteAsync(cancellationToken);
    }
}
