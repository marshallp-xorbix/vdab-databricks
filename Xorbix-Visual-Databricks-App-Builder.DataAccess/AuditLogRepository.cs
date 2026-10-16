using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;
/// <summary>
/// Provides data access operations for AuditLog components.
/// </summary>
public class AuditLogRepository(ApplicationDbContext _context) : IAuditLogRepository
{

    ///<inheritdoc/>
    public async Task LogAsync(AuditLog auditLog)
    {
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
    }

    ///<inheritdoc/>
    public async Task<(IReadOnlyList<AuditLogDto> Items, AuditLogCursor? NextCursor)> QueryAsync(AuditLogQuery query, CancellationToken cancellationToken)
    {
        IQueryable<AuditLog> filtered = _context.AuditLogs.AsNoTracking();

        if (query.UserId is Guid userId)
        {
            filtered = filtered.Where(l => l.UserId == userId);
        }

        if (query.TenantId is Guid tenantId)
        {
            filtered = filtered.Where(l => l.TenantId == tenantId);
        }

        if (query.ActionTypes is { Count: > 0 } actionTypes)
        {
            filtered = filtered.Where(l => actionTypes.Contains(l.ActionType));
        }

        if (query.Severities is { Count: > 0 } severities)
        {
            filtered = filtered.Where(l => severities.Contains(l.Severity));
        }

        if (query.StartDate is DateTime start)
        {
            filtered = filtered.Where(l => l.Timestamp >= start);
        }

        if (query.EndDate is DateTime end)
        {
            filtered = filtered.Where(l => l.Timestamp <= end);
        }

        if (!query.IncludeArchived)
        {
            filtered = filtered.Where(l => !l.IsArchived);
        }

        // Keyset pagination: advance past the last row of the previous page.
        // (Timestamp, AuditLogId) is a total ordering — ID breaks timestamp ties.
        if (query.Cursor is { } cursor)
        {
            DateTime cursorTimestamp = cursor.Timestamp;
            long cursorId = cursor.AuditLogId;
            filtered = filtered.Where(l =>
                l.Timestamp < cursorTimestamp ||
                (l.Timestamp == cursorTimestamp && l.AuditLogId < cursorId));
        }

        // Fetch one extra row so we can detect end-of-stream without a COUNT(*).
        int fetchSize = query.Take + 1;

        List<AuditLogDto> rows = await filtered
            .OrderByDescending(l => l.Timestamp)
            .ThenByDescending(l => l.AuditLogId)
            .Take(fetchSize)
            .Select(l => new AuditLogDto
            {
                AuditLogId = l.AuditLogId,
                TenantId = l.TenantId,
                TenantDisplayName = l.Tenant != null ? l.Tenant.DisplayName : null,
                UserId = l.UserId,
                UserFullName = l.User != null ? (l.User.FirstName + " " + l.User.LastName).Trim() : null,
                UserEmail = l.User != null ? l.User.Email : null,
                IsArchived = l.IsArchived,
                ActionType = l.ActionType,
                EntityType = l.EntityType,
                EntityId = l.EntityId,
                Description = l.Description,
                Metadata = l.Metadata,
                IpAddress = l.IpAddress,
                UserAgent = l.UserAgent,
                Severity = l.Severity,
                Timestamp = l.Timestamp,
            })
            .ToListAsync(cancellationToken);

        AuditLogCursor? nextCursor = null;
        if (rows.Count > query.Take)
        {
            // Trim the sentinel row; build a cursor from the last *returned* row.
            rows.RemoveAt(rows.Count - 1);
            AuditLogDto last = rows[^1];
            nextCursor = new AuditLogCursor(last.Timestamp, last.AuditLogId);
        }

        return (rows, nextCursor);
    }

    ///<inheritdoc/>
    public async Task<List<AuditLog>> GetByTenantAsync(Tenant? tenant, int skip, int take)
    {
        IQueryable<AuditLog> query = _context.AuditLogs
            .AsNoTracking()
            .Where(t => t.Tenant == tenant)
            .OrderBy(x => x.Timestamp);

        List<AuditLog> auditLogs = await query
            .Skip(skip)
            .Take(take)
            .ToListAsync();
        return auditLogs;
    }

    ///<inheritdoc/>
    public async Task<List<AuditLog>> GetByTenantOnRangeAsync(Tenant? tenant, DateTime startDate, DateTime endDate, int skip, int take)
    {
        IQueryable<AuditLog> query = _context.AuditLogs
            .AsNoTracking()
            .Where(t => t.Tenant == tenant &&  t.Timestamp >= startDate && t.Timestamp <= endDate)
            .OrderBy(x => x.Timestamp);

        List<AuditLog> auditLogs = await query
            .Skip(skip)
            .Take(take)
            .ToListAsync();
        return auditLogs;
    }

    ///<inheritdoc/>
    public async Task<List<AuditLog>> GetByUserAsync(Guid? userId, int skip, int take)
    {
        IQueryable<AuditLog> query = _context.AuditLogs
            .AsNoTracking()
            .Where(t => t.UserId == userId)
            .OrderBy(x => x.Timestamp);

        List<AuditLog> auditLogs = await query
            .Skip(skip)
            .Take(take)
            .ToListAsync();
        return auditLogs;
    }

    ///<inheritdoc/>
    public async Task<List<AuditLog>> GetAllAuditLogsAsync(int skip, int take)
    {
        IQueryable<AuditLog> query = _context.AuditLogs
            .AsNoTracking()
            .OrderBy(x => x.Timestamp);

        List<AuditLog> auditLogs = await query
            .Skip(skip)
            .Take(take)
            .ToListAsync();
        return auditLogs;
    }

    ///<inheritdoc/>
    public async Task MarkArchivedAsync(AuditLog auditLog, CancellationToken token)
    {
        _context.AuditLogs.Update(auditLog);
        auditLog.IsArchived = true;
        await _context.SaveChangesAsync();
    }

    ///<inheritdoc/>
    public async Task<List<AuditLog>> GetRecordsForArchivalAsync(DateTime start, DateTime end, int skip, int take)
    {
        IQueryable<AuditLog> query = _context.AuditLogs
            .AsNoTracking()
            .Where(t => t.Timestamp <= end && t.Timestamp >= start && !t.IsArchived)
            .OrderBy(x => x.Timestamp);
           
        List<AuditLog> auditLogs = await query
            .Skip(skip)
            .Take(take)
            .ToListAsync();
        return auditLogs;
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.AuditLogs
            .Where(log => log.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AuditLogs
            .Where(log => log.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }
}

