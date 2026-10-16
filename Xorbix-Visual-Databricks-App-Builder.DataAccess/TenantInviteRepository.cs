using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// EF Core repository for <see cref="TenantInvite"/>.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="TenantInviteRepository"/> class.
/// </remarks>
/// <param name="context">The database context.</param>
public class TenantInviteRepository(ApplicationDbContext _context) : ITenantInviteRepository
{
    /// <inheritdoc/>
    public async Task<IEnumerable<TenantInvite>> GetPendingByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.TenantInvites
            .AsNoTracking()
            .Where(i => i.TenantId == tenantId
                && i.Status == TenantInviteStatuses.Pending
                && i.DeletedOn == null)
            .OrderByDescending(i => i.InvitedAt)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<TenantInvite?> GetByIdAsync(Guid inviteId, CancellationToken cancellationToken = default)
    {
        return await _context.TenantInvites
            .FirstOrDefaultAsync(i => i.Id == inviteId && i.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<TenantInvite?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default)
    {
        return await _context.TenantInvites
            .Include(i => i.Tenant)
            .FirstOrDefaultAsync(i => i.TokenHash == tokenHash && i.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<TenantInvite?> GetPendingByEmailAsync(Guid tenantId, string normalizedEmail, CancellationToken cancellationToken = default)
    {
        return await _context.TenantInvites
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.TenantId == tenantId
                && i.NormalizedEmail == normalizedEmail
                && i.Status == TenantInviteStatuses.Pending
                && i.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task AddRangeAsync(IEnumerable<TenantInvite> invites, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        List<TenantInvite> list = invites.ToList();
        foreach (TenantInvite invite in list)
        {
            invite.CreatedOn = now;
            invite.InvitedAt = now;
        }

        _context.TenantInvites.AddRange(list);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task UpdateAsync(TenantInvite invite, CancellationToken cancellationToken = default)
    {
        invite.ModifiedOn = DateTime.UtcNow;
        _context.TenantInvites.Update(invite);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public Task<int> CountPendingInvitesAsync(CancellationToken cancellationToken = default)
    {
        return _context.TenantInvites
            .AsNoTracking()
            .Where(i => i.Status == TenantInviteStatuses.Pending && i.DeletedOn == null)
            .CountAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> CancelPendingByTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        return await _context.TenantInvites
            .Where(i => i.TenantId == tenantId
                && i.DeletedOn == null
                && i.Status == TenantInviteStatuses.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.Status, TenantInviteStatuses.Canceled)
                .SetProperty(i => i.DeletedOn, (DateTime?)now)
                .SetProperty(i => i.DeletedBy, (Guid?)deletedByUserId)
                .SetProperty(i => i.ModifiedOn, (DateTime?)now)
                .SetProperty(i => i.ModifiedBy, (Guid?)deletedByUserId), cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.TenantInvites
            .Where(i => i.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
