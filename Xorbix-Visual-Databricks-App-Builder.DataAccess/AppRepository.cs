using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    public class AppRepository : IAppRepository
    {
        private readonly ApplicationDbContext _context;

        public AppRepository(ApplicationDbContext context)
        {
            _context = context;
        }
        public async Task<App?> GetByNameAsync(string appName)
        {
            return await _context.Apps
                .FirstOrDefaultAsync(a => a.AppName == appName && a.DeletedOn == null);
        }
        /// <inheritdoc/>
        public async Task<App?> GetByIdAsync(int id)
        {
            return await _context.Apps
                                 .AsNoTracking()
                                 .Include(a => a.User)
                                 .FirstOrDefaultAsync(x => x.PkId == id);
        }
        /// <inheritdoc/>
        public async Task<IEnumerable<App>> GetByOwnerIdAsync(Guid ownerId)
        {
            return await _context.Apps
                                 .AsNoTracking()
                                 .Where(x => x.OwnerId == ownerId)
                                 .ToListAsync();
        }
        /// <inheritdoc/>
        public async Task<IEnumerable<App>> GetAllAsync()
        {
            return await _context.Apps
                                 .AsNoTracking()
                                 .ToListAsync();
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<App>> GetByTenantIdAsync(Guid tenantId)
        {
            return await _context.Apps
                                 .AsNoTracking()
                                 .Where(x => x.TenantId == tenantId && x.DeletedOn == null)
                                 .OrderByDescending(x => x.ModifiedOn ?? x.CreatedOn)
                                 .ToListAsync();
        }

        /// <inheritdoc/>
        public async Task AddAsync(App app)
        {
            _context.Apps.Add(app);
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task UpdateAsync(App app)
        {
            _context.Update(app);
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task DeleteAsync(App app)
        {
            // Soft delete: set DeletedOn instead of removing
            app.DeletedOn = DateTime.UtcNow;
            // DeletedBy can be set by the service layer when user context is available
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task TouchModifiedUtcAsync(int appId, Guid modifiedBy)
        {
            DateTime utcNow = DateTime.UtcNow;
            await _context.Apps
                .Where(a => a.PkId == appId && a.DeletedOn == null)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.ModifiedOn, utcNow)
                    .SetProperty(a => a.ModifiedBy, modifiedBy));
        }

        /// <inheritdoc/>
        public Task<int> CountActiveAppsAsync(CancellationToken cancellationToken = default)
        {
            return _context.Apps
                .AsNoTracking()
                .Where(a => a.DeletedOn == null)
                .CountAsync(cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<int> SoftDeleteByTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default)
        {
            DateTime now = DateTime.UtcNow;
            return await _context.Apps
                .Where(a => a.TenantId == tenantId && a.DeletedOn == null)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.DeletedOn, (DateTime?)now)
                    .SetProperty(a => a.DeletedBy, (Guid?)deletedByUserId)
                    .SetProperty(a => a.ModifiedOn, (DateTime?)now)
                    .SetProperty(a => a.ModifiedBy, (Guid?)deletedByUserId), cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<int> HardDeleteForTenantPurgeAsync(
            Guid tenantId,
            IReadOnlyCollection<int> connectionIds,
            CancellationToken cancellationToken = default)
        {
            if (connectionIds.Count == 0)
            {
                return await _context.Apps
                    .Where(a => a.TenantId == tenantId)
                    .ExecuteDeleteAsync(cancellationToken);
            }

            return await _context.Apps
                .Where(a => a.TenantId == tenantId || connectionIds.Contains(a.WorkspaceConnectionId))
                .ExecuteDeleteAsync(cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<int> HardDeleteForUserPurgeAsync(
            Guid ownerId,
            IReadOnlyCollection<int> connectionIds,
            CancellationToken cancellationToken = default)
        {
            if (connectionIds.Count == 0)
            {
                return await _context.Apps
                    .Where(a => a.OwnerId == ownerId)
                    .ExecuteDeleteAsync(cancellationToken);
            }

            return await _context.Apps
                .Where(a => a.OwnerId == ownerId || connectionIds.Contains(a.WorkspaceConnectionId))
                .ExecuteDeleteAsync(cancellationToken);
        }
    }
}
