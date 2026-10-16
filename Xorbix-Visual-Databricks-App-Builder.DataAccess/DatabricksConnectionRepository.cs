using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    public class DatabricksConnectionRepository : IDatabricksConnectionRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IEncryptionHelper _encryption;

        public DatabricksConnectionRepository(ApplicationDbContext context, IEncryptionHelper encryption)
        {
            _context = context;
            _encryption = encryption;
        }

        /// <inheritdoc/>
        public async Task<DatabricksConnection?> GetByIdAsync(int id)
        {
            var connection = await _context.DatabricksConnections
                                           .AsNoTracking()
                                           .FirstOrDefaultAsync(x => x.PkId == id);

            return connection;
        }

        /// <inheritdoc/>
        public async Task<DatabricksConnection?> GetByIdForTenantAsync(
            int connectionId,
            Guid tenantId,
            CancellationToken cancellationToken = default)
        {
            DatabricksConnection? connection = await _context.DatabricksConnections
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    c => c.PkId == connectionId
                         && c.TenantId == tenantId
                         && c.DeletedOn == null,
                    cancellationToken);

            return connection;
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<DatabricksConnection>> GetByUserAsync(Guid ownerId)
        {
            var connections = await _context.DatabricksConnections
                                 .AsNoTracking()
                                 .Where(x => x.OwnerId == ownerId)
                                 .ToListAsync();

            return connections;
        }
        /// <inheritdoc/>
        public async Task<DatabricksConnection?> GetByWorkspaceUrlAsync(string workspaceUrl)
        {
            var connection = await _context.DatabricksConnections
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.WorkspaceUrl == workspaceUrl);

            return connection;
        }

        /// <inheritdoc/>
        public async Task<DatabricksConnection?> GetByTenantAndWorkspaceUrlAsync(
            Guid tenantId,
            string workspaceUrl,
            CancellationToken cancellationToken = default)
        {
            DatabricksConnection? connection = await _context.DatabricksConnections
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    c => c.TenantId == tenantId
                         && c.DeletedOn == null
                         && c.WorkspaceUrl == workspaceUrl,
                    cancellationToken);

            return connection;
        }

        /// <inheritdoc/>
        public Task<bool> ExistsByTenantAndWorkspaceUrlAsync(
            Guid tenantId,
            string workspaceUrl,
            int? excludeConnectionId = null,
            CancellationToken cancellationToken = default)
        {
            IQueryable<DatabricksConnection> query = _context.DatabricksConnections
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId
                            && c.DeletedOn == null
                            && c.WorkspaceUrl == workspaceUrl);

            if (excludeConnectionId.HasValue)
            {
                query = query.Where(c => c.PkId != excludeConnectionId.Value);
            }

            return query.AnyAsync(cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<DatabricksConnection>> GetAllAsync()
        {
            var connections = await _context.DatabricksConnections
                                 .AsNoTracking()
                                 .ToListAsync();

            return connections;
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<DatabricksConnection>> GetByTenantIdAsync(
            Guid tenantId,
            CancellationToken cancellationToken = default)
        {
            List<DatabricksConnection> connections = await _context.DatabricksConnections
                                 .AsNoTracking()
                                 .Where(x => x.TenantId == tenantId)
                                 .ToListAsync(cancellationToken);

            return connections;
        }

        /// <inheritdoc/>
        public async Task AddAsync(DatabricksConnection connection)
        {
            _context.DatabricksConnections.Add(connection);
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task UpdateAsync(DatabricksConnection connection)
        {
            _context.Update(connection);
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task DeleteAsync(DatabricksConnection connection)
        {
            _context.DatabricksConnections.Remove(connection);
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public Task<int> CountActiveWorkspacesAsync(CancellationToken cancellationToken = default)
        {
            return _context.DatabricksConnections
                .AsNoTracking()
                .Where(c => c.DeletedOn == null)
                .CountAsync(cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<int> SoftDeleteByTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default)
        {
            DateTime now = DateTime.UtcNow;
            return await _context.DatabricksConnections
                .Where(c => c.TenantId == tenantId && c.DeletedOn == null)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.DeletedOn, (DateTime?)now)
                    .SetProperty(c => c.DeletedBy, (Guid?)deletedByUserId)
                    .SetProperty(c => c.ModifiedOn, (DateTime?)now)
                    .SetProperty(c => c.ModifiedBy, (Guid?)deletedByUserId), cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
        {
            return await _context.DatabricksConnections
                .Where(c => c.TenantId == tenantId)
                .ExecuteDeleteAsync(cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<IReadOnlyList<int>> GetIdsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
        {
            return await _context.DatabricksConnections
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId)
                .Select(c => c.PkId)
                .ToListAsync(cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<IReadOnlyList<int>> GetIdsByOwnerAsync(Guid ownerId, CancellationToken cancellationToken = default)
        {
            return await _context.DatabricksConnections
                .AsNoTracking()
                .Where(c => c.OwnerId == ownerId)
                .Select(c => c.PkId)
                .ToListAsync(cancellationToken);
        }

        /// <inheritdoc/>
        public async Task<int> HardDeleteByOwnerAsync(Guid ownerId, CancellationToken cancellationToken = default)
        {
            return await _context.DatabricksConnections
                .Where(c => c.OwnerId == ownerId)
                .ExecuteDeleteAsync(cancellationToken);
        }
    }
}
