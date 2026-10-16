using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// EF Core repository for <see cref="BetaCode"/> and <see cref="BetaCodeRedemption"/>.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="BetaCodeRepository"/> class.
/// </remarks>
/// <param name="_context">The database context.</param>
public class BetaCodeRepository(ApplicationDbContext _context) : IBetaCodeRepository
{
    /// <inheritdoc/>
    public async Task<BetaCode?> GetByCodeAsync(string normalizedCode, CancellationToken cancellationToken = default)
    {
        return await _context.BetaCodes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Code == normalizedCode && c.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> TryIncrementRedemptionAsync(Guid betaCodeId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        int updatedCount = await _context.BetaCodes
            .Where(c => c.BetaCodeId == betaCodeId
                && c.IsActive
                && c.DeletedOn == null
                && (c.MaxRedemptions == null || c.RedemptionCount < c.MaxRedemptions))
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.RedemptionCount, c => c.RedemptionCount + 1)
                .SetProperty(c => c.ModifiedOn, (DateTime?)now), cancellationToken);

        return updatedCount == 1;
    }

    /// <inheritdoc/>
    public async Task<bool> HasTenantRedeemedAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.BetaCodeRedemptions
            .AsNoTracking()
            .AnyAsync(r => r.TenantId == tenantId && r.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task AddRedemptionAsync(BetaCodeRedemption redemption, CancellationToken cancellationToken = default)
    {
        redemption.CreatedOn = DateTime.UtcNow;
        _context.BetaCodeRedemptions.Add(redemption);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task ReleaseRedemptionAsync(Guid betaCodeId, CancellationToken cancellationToken = default)
    {
        await _context.BetaCodes
            .Where(c => c.BetaCodeId == betaCodeId && c.RedemptionCount > 0)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.RedemptionCount, c => c.RedemptionCount - 1), cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteRedemptionsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.BetaCodeRedemptions
            .Where(r => r.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
