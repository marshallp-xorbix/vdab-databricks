using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for managing tenant data access.
/// </summary>
public class TenantRepository(ApplicationDbContext _context) : ITenantRepository
{

    /// <inheritdoc/>
    public async Task<Tenant?> GetByIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Tenant? tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.DeletedOn == null, cancellationToken);

        return tenant;
    }

    /// <inheritdoc/>
    public async Task<Tenant?> GetByIdForUpdateAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Tenant? trackedTenant = _context.ChangeTracker
            .Entries<Tenant>()
            .Select(entry => entry.Entity)
            .FirstOrDefault(tenant => tenant.TenantId == tenantId && tenant.DeletedOn == null);

        if (trackedTenant != null)
        {
            return trackedTenant;
        }

        return await _context.Tenants
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<Tenant?> GetByNameAsync(string tenantName, CancellationToken cancellationToken = default)
    {
        Tenant? tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantName == tenantName && t.DeletedOn == null, cancellationToken);

        return tenant;
    }

    /// <inheritdoc/>
    public async Task<Tenant?> GetByBillingCustomerIdAsync(string billingCustomerId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(billingCustomerId))
        {
            return null;
        }

        Tenant? tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.BillingCustomerId == billingCustomerId && t.DeletedOn == null, cancellationToken);

        return tenant;
    }

    /// <inheritdoc/>
    public async Task<Tenant?> GetByStripeSubscriptionIdAsync(string stripeSubscriptionId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(stripeSubscriptionId))
        {
            return null;
        }

        Tenant? tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.StripeSubscriptionId == stripeSubscriptionId && t.DeletedOn == null, cancellationToken);

        return tenant;
    }

    /// <inheritdoc/>
    public async Task<Tenant> CreateAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        tenant.CreatedOn = DateTime.UtcNow;

        _context.Tenants.Add(tenant);
        await _context.SaveChangesAsync(cancellationToken);

        return tenant;
    }

    /// <inheritdoc/>
    public async Task UpdateAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        tenant.ModifiedOn = DateTime.UtcNow;

        _context.Tenants.Update(tenant);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<TenantUsageStatsDto?> GetUsageStatsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Tenant? tenant = await _context.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.DeletedOn == null, cancellationToken);

        if (tenant == null)
            return null;

        int userCount = await _context.UserTenantMemberships
            .CountAsync(m => m.TenantId == tenantId && m.DeletedOn == null && m.Status == MembershipStatus.Active, cancellationToken);

        int appCount = await _context.Apps
            .CountAsync(a => a.TenantId == tenantId && a.DeletedOn == null, cancellationToken);

        int connectionCount = await _context.DatabricksConnections
            .CountAsync(c => c.TenantId == tenantId && c.DeletedOn == null, cancellationToken);

        TenantUsageStatsDto stats = new()
        {
            TenantId = tenant.TenantId,
            DisplayName = tenant.DisplayName,
            SubscriptionTier = tenant.SubscriptionTier,
            SubscriptionStatus = tenant.SubscriptionStatus,
            UserCount = userCount,
            AppCount = appCount,
            ConnectionCount = connectionCount,
            MaxUsers = tenant.MaxUsers,
            MaxPublishedApps = tenant.MaxPublishedApps,
            MaxWorkspaceConnections = tenant.MaxWorkspaceConnections
        };

        return stats;
    }

    /// <inheritdoc/>
    public async Task<(List<Tenant> Tenants, int TotalCount)> GetAllAsync(int skip, int take, CancellationToken cancellationToken = default)
    {
        IQueryable<Tenant> query = _context.Tenants
            .AsNoTracking()
            .Where(t => t.DeletedOn == null)
            .OrderBy(t => t.TenantName);

        int totalCount = await query.CountAsync(cancellationToken);

        List<Tenant> tenants = await query
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        return (tenants, totalCount);
    }

    /// <inheritdoc/>
    public async Task<(List<TenantDto> Tenants, int TotalCount)> GetAllForManagementAsync(int skip, int take, CancellationToken cancellationToken = default)
    {
        IQueryable<Tenant> query = _context.Tenants
            .AsNoTracking()
            .Where(t => t.DeletedOn == null)
            .OrderBy(t => t.TenantName);

        int totalCount = await query.CountAsync(cancellationToken);

        List<TenantDto> tenants = await query
            .Skip(skip)
            .Take(take)
            .Select(tenant => new TenantDto
            {
                TenantId = tenant.TenantId,
                TenantName = tenant.TenantName,
                DisplayName = tenant.DisplayName,
                IsActive = tenant.IsActive,
                SubscriptionTier = tenant.SubscriptionTier,
                BillingCycle = tenant.BillingCycle,
                MaxUsers = tenant.MaxUsers,
                MaxPublishedApps = tenant.MaxPublishedApps,
                MaxWorkspaceConnections = tenant.MaxWorkspaceConnections,
                UserCount = _context.UserTenantMemberships.Count(membership => membership.TenantId == tenant.TenantId && membership.DeletedOn == null && membership.Status == MembershipStatus.Active),
                AppCount = _context.Apps.Count(app => app.TenantId == tenant.TenantId && app.DeletedOn == null),
                SubscriptionStartDate = tenant.SubscriptionStartDate,
                SubscriptionEndDate = tenant.SubscriptionEndDate,
                TrialEndDate = tenant.TrialEndDate,
                AutoRenew = tenant.AutoRenew,
                OwnerId = tenant.OwnerId,
                InvoiceName = tenant.InvoiceName,
                InvoiceEmail = tenant.InvoiceEmail,
                SubscriptionStatus = tenant.SubscriptionStatus,
                BillingCustomerId = tenant.BillingCustomerId,
                StripeSubscriptionId = tenant.StripeSubscriptionId,
                CancelAtPeriodEnd = tenant.CancelAtPeriodEnd,
                CreatedOn = tenant.CreatedOn
            })
            .ToListAsync(cancellationToken);

        return (tenants, totalCount);
    }

    /// <inheritdoc/>
    public async Task<bool> SetActiveAsync(Guid tenantId, bool isActive, Guid modifiedByUserId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        int affected = await _context.Tenants
            .Where(t => t.TenantId == tenantId && t.DeletedOn == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.IsActive, isActive)
                .SetProperty(t => t.ModifiedOn, now)
                .SetProperty(t => t.ModifiedBy, modifiedByUserId), cancellationToken);

        return affected > 0;
    }

    /// <inheritdoc/>
    public async Task<bool> SoftDeleteAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        int affected = await _context.Tenants
            .Where(t => t.TenantId == tenantId && t.DeletedOn == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.IsActive, false)
                .SetProperty(t => t.DeletedOn, (DateTime?)now)
                .SetProperty(t => t.DeletedBy, (Guid?)deletedByUserId)
                .SetProperty(t => t.ModifiedOn, (DateTime?)now)
                .SetProperty(t => t.ModifiedBy, (Guid?)deletedByUserId), cancellationToken);

        return affected > 0;
    }

    /// <inheritdoc/>
    public async Task<bool> HardDeleteAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        int affected = await _context.Tenants
            .Where(t => t.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);

        return affected > 0;
    }

    /// <inheritdoc/>
    public Task<bool> IsOwnerOfAnyTenantAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return _context.Tenants
            .AsNoTracking()
            .AnyAsync(t => t.OwnerId == userId && t.DeletedOn == null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> ClearOwnerIdForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Tenants
            .Where(t => t.OwnerId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.OwnerId, (Guid?)null), cancellationToken);
    }

    /// <inheritdoc/>
    public Task<int> CountActiveTenantsAsync(CancellationToken cancellationToken = default)
    {
        return _context.Tenants
            .AsNoTracking()
            .Where(t => t.DeletedOn == null && t.IsActive)
            .CountAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public Task<int> CountTenantsCreatedSinceAsync(DateTime sinceUtc, CancellationToken cancellationToken = default)
    {
        return _context.Tenants
            .AsNoTracking()
            .Where(t => t.DeletedOn == null && t.CreatedOn >= sinceUtc)
            .CountAsync(cancellationToken);
    }
}
