using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for managing user-tenant membership data access.
/// </summary>
public class UserTenantMembershipRepository(ApplicationDbContext _context) : IUserTenantMembershipRepository
{

    /// <inheritdoc/>
    public async Task<IEnumerable<UserTenantMembership>> GetLiveByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AsNoTracking()
            .Include(m => m.Tenant)
            .Where(m => m.UserId == userId && m.DeletedOn == null)
            .OrderByDescending(m => m.IsDefault)
            .ThenByDescending(m => m.LastAccessedAt)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<UserTenantMembership>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AsNoTracking()
            .Include(m => m.Tenant)
            .Where(m => m.UserId == userId
                && m.DeletedOn == null
                && m.Status == MembershipStatus.Active)
            .OrderByDescending(m => m.IsDefault)
            .ThenByDescending(m => m.LastAccessedAt)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<UserTenantMembership>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AsNoTracking()
            .Include(m => m.User)
            .Where(m => m.TenantId == tenantId && m.DeletedOn == null)
            .OrderBy(m => m.User!.LastName)
            .ThenBy(m => m.User!.FirstName)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<UserTenantMembership?> GetByUserAndTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AsNoTracking()
            .Include(m => m.Tenant)
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.UserId == userId && m.TenantId == tenantId && m.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<UserTenantMembership?> GetUserDefaultTenantAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AsNoTracking()
            .Include(m => m.Tenant)
            .FirstOrDefaultAsync(
                m => m.UserId == userId
                    && m.IsDefault
                    && m.DeletedOn == null
                    && m.Status == MembershipStatus.Active,
                cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<UserTenantMembership?> GetUserLastAccessedTenantAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AsNoTracking()
            .Include(m => m.Tenant)
            .Where(m => m.UserId == userId
                && m.LastAccessedAt != null
                && m.DeletedOn == null
                && m.Status == MembershipStatus.Active)
            .OrderByDescending(m => m.LastAccessedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> UpdateLastAccessedAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        UserTenantMembership? membership = await _context.UserTenantMemberships
            .FirstOrDefaultAsync(
                m => m.UserId == userId
                    && m.TenantId == tenantId
                    && m.DeletedOn == null
                    && m.Status == MembershipStatus.Active,
                cancellationToken);

        if (membership == null)
            return false;

        membership.LastAccessedAt = DateTime.UtcNow;
        membership.ModifiedOn = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <inheritdoc/>
    public async Task<UserTenantMembership> AddAsync(UserTenantMembership membership, CancellationToken cancellationToken = default)
    {
        membership.CreatedOn = DateTime.UtcNow;
        membership.JoinedAt = DateTime.UtcNow;

        _context.UserTenantMemberships.Add(membership);
        await _context.SaveChangesAsync(cancellationToken);

        return membership;
    }

    /// <inheritdoc/>
    public async Task UpdateAsync(UserTenantMembership membership, CancellationToken cancellationToken = default)
    {
        membership.ModifiedOn = DateTime.UtcNow;
        // Entry(...).State does not traverse navigations, so an Include()d User/Tenant
        // is never marked Modified. DbSet.Update() would write those rows too.
        _context.Entry(membership).State = EntityState.Modified;
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> RemoveAsync(
        Guid userId,
        Guid tenantId,
        Guid? deletedByUserId = null,
        CancellationToken cancellationToken = default)
    {
        UserTenantMembership? membership = await _context.UserTenantMemberships
            .FirstOrDefaultAsync(m => m.UserId == userId && m.TenantId == tenantId && m.DeletedOn == null, cancellationToken);

        if (membership == null)
            return false;

        // Soft delete as Ended membership
        membership.IsDefault = false;
        membership.Status = MembershipStatus.Ended;
        membership.DeletedOn = DateTime.UtcNow;
        membership.DeletedBy = deletedByUserId;
        membership.ModifiedOn = DateTime.UtcNow;
        membership.ModifiedBy = deletedByUserId;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <inheritdoc/>
    public async Task<UserTenantMembership?> GetSoftDeletedByUserAndTenantAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .OrderByDescending(membership => membership.DeletedOn)
            .FirstOrDefaultAsync(
                membership => membership.UserId == userId
                    && membership.TenantId == tenantId
                    && membership.DeletedOn != null,
                cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<UserTenantMembership>> GetSoftDeletedByTenantIdAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        List<UserTenantMembership> ended = await _context.UserTenantMemberships
            .AsNoTracking()
            .Include(m => m.User)
            .Where(m => m.TenantId == tenantId && m.DeletedOn != null && m.Status == MembershipStatus.Ended)
            .ToListAsync(cancellationToken);

        // Expired reinstatement can leave multiple Ended rows per user; restore and the
        // recovery UI only act on the latest removal.
        return ended
            .GroupBy(m => m.UserId)
            .Select(g => g.OrderByDescending(m => m.DeletedOn).First())
            .OrderByDescending(m => m.DeletedOn)
            .ThenBy(m => m.User?.LastName)
            .ThenBy(m => m.User?.FirstName)
            .ToList();
    }

    /// <inheritdoc/>
    public Task<bool> HasSoftDeletedInOtherTenantsAsync(
        Guid userId,
        Guid excludeTenantId,
        CancellationToken cancellationToken = default)
    {
        return _context.UserTenantMemberships
            .AsNoTracking()
            .AnyAsync(
                m => m.UserId == userId
                    && m.TenantId != excludeTenantId
                    && m.DeletedOn != null,
                cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> ExistsAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AnyAsync(m => m.UserId == userId && m.TenantId == tenantId && m.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> ExistsActiveAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AnyAsync(
                m => m.UserId == userId
                    && m.TenantId == tenantId
                    && m.DeletedOn == null
                    && m.Status == MembershipStatus.Active,
                cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> HasLiveMembershipAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .AnyAsync(m => m.UserId == userId && m.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> GetTenantUserCountAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .CountAsync(
                m => m.TenantId == tenantId
                    && m.DeletedOn == null
                    && m.Status == MembershipStatus.Active,
                cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<List<Guid>> GetSoleTenantUserIdsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        List<Guid> userIdsInTenant = await _context.UserTenantMemberships
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.DeletedOn == null)
            .Select(m => m.UserId)
            .ToListAsync(cancellationToken);

        if (userIdsInTenant.Count == 0)
        {
            return userIdsInTenant;
        }

        List<Guid> userIdsWithOtherMemberships = await _context.UserTenantMemberships
            .AsNoTracking()
            .Where(m => userIdsInTenant.Contains(m.UserId)
                && m.TenantId != tenantId
                && m.DeletedOn == null)
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);

        HashSet<Guid> excluded = userIdsWithOtherMemberships.ToHashSet();
        return userIdsInTenant.Where(id => !excluded.Contains(id)).Distinct().ToList();
    }

    /// <inheritdoc/>
    public async Task<int> SoftDeleteAllForTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        return await _context.UserTenantMemberships
            .Where(m => m.TenantId == tenantId && m.DeletedOn == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(m => m.IsDefault, false)
                .SetProperty(m => m.Status, MembershipStatus.Ended)
                .SetProperty(m => m.DeletedOn, (DateTime?)now)
                .SetProperty(m => m.DeletedBy, (Guid?)deletedByUserId)
                .SetProperty(m => m.ModifiedOn, (DateTime?)now)
                .SetProperty(m => m.ModifiedBy, (Guid?)deletedByUserId), cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteAllForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .Where(m => m.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteAllForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantMemberships
            .Where(m => m.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
