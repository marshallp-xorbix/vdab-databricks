using Npgsql;
using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for Stripe webhook/event log records.
/// </summary>
public class StripeEventLogRepository : IStripeEventLogRepository
{
    private const int MaxPageSize = 200;
    private readonly ApplicationDbContext _context;

    /// <summary>
    /// Initializes a new instance of the <see cref="StripeEventLogRepository"/> class.
    /// </summary>
    /// <param name="context">The database context.</param>
    public StripeEventLogRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc/>
    public async Task<bool> ExistsAsync(string stripeEventId)
    {
        return await _context.StripeEventLogs
            .AsNoTracking()
            .AnyAsync(x => x.StripeEventId == stripeEventId);
    }

    /// <inheritdoc/>
    public async Task AddAsync(StripeEventLog log)
    {
        _context.StripeEventLogs.Add(log);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Duplicate StripeEventId means another process already logged the event.
            _context.Entry(log).State = EntityState.Detached;
        }
    }

    /// <inheritdoc/>
    public async Task<List<StripeEventLog>> GetRecentAsync(int pageNumber, int pageSize)
    {
        (int skip, int safePageSize) = GetPaginationBounds(pageNumber, pageSize);

        return await BuildRecentQuery()
            .Skip(skip)
            .Take(safePageSize)
            .ToListAsync();
    }

    /// <inheritdoc/>
    public async Task<(List<StripeEventLog> Logs, int TotalCount)> GetRecentWithCountAsync(int pageNumber, int pageSize)
    {
        (int skip, int safePageSize) = GetPaginationBounds(pageNumber, pageSize);
        IQueryable<StripeEventLog> baseQuery = _context.StripeEventLogs.AsNoTracking();

        int totalCount = await baseQuery.CountAsync();

        List<StripeEventLog> logs = await BuildRecentQuery(baseQuery)
            .Skip(skip)
            .Take(safePageSize)
            .ToListAsync();

        return (logs, totalCount);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByCustomerIdAsync(string customerId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return 0;
        }

        return await _context.StripeEventLogs
            .Where(log => log.CustomerId == customerId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        return ex.InnerException is PostgresException pgEx
            && pgEx.SqlState == "23505";
    }

    private static (int Skip, int SafePageSize) GetPaginationBounds(int pageNumber, int pageSize)
    {
        int safePageNumber = Math.Max(pageNumber, 1);
        int safePageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        int skip = (safePageNumber - 1) * safePageSize;

        return (skip, safePageSize);
    }

    private IOrderedQueryable<StripeEventLog> BuildRecentQuery()
    {
        return BuildRecentQuery(_context.StripeEventLogs.AsNoTracking());
    }

    private static IOrderedQueryable<StripeEventLog> BuildRecentQuery(IQueryable<StripeEventLog> query)
    {
        return query
            .OrderByDescending(x => x.ProcessedAt)
            .ThenByDescending(x => x.Id);
    }
}