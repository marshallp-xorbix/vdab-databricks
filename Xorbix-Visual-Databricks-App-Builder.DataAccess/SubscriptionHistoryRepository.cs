using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for subscription history data access.
/// </summary>
public class SubscriptionHistoryRepository : ISubscriptionHistoryRepository
{
    private readonly ApplicationDbContext _context;

    /// <summary>
    /// Initializes a new instance of the <see cref="SubscriptionHistoryRepository"/> class.
    /// </summary>
    /// <param name="context">Database context instance.</param>
    public SubscriptionHistoryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc/>
    public async Task AddAsync(SubscriptionHistory record)
    {
        ArgumentNullException.ThrowIfNull(record);

        record.CreatedOn = DateTime.UtcNow;
        _context.SubscriptionHistory.Add(record);
        await _context.SaveChangesAsync();
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<SubscriptionHistory>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        List<SubscriptionHistory> records = await _context.SubscriptionHistory
            .AsNoTracking()
            .Where(history => history.TenantId == tenantId && history.DeletedOn == null)
            .OrderByDescending(history => history.EventDate)
            .ToListAsync(cancellationToken);

        return records;
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.SubscriptionHistory
            .Where(history => history.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
