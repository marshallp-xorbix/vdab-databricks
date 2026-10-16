using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for subscription seat data access.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="SubscriptionSeatRepository"/> class.
/// </remarks>
/// <param name="context">The database context.</param>
public class SubscriptionSeatRepository(ApplicationDbContext _context) : ISubscriptionSeatRepository
{
    private const string ActiveStatus = "Active";
    private const string PendingCancellationStatus = "PendingCancellation";
    private const string CanceledStatus = "Canceled";

    /// <inheritdoc/>
    public async Task<IEnumerable<SubscriptionSeat>> GetByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await BuildNonCanceledTenantQuery(tenantId)
            .AsNoTracking()
            .Include(seat => seat.User)
            .OrderBy(seat => seat.SeatStartDate)
            .ThenBy(seat => seat.SubscriptionSeatId)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<SubscriptionSeat?> GetByIdAsync(Guid seatId, CancellationToken cancellationToken = default)
    {
        return await _context.SubscriptionSeats
            .AsNoTracking()
            .Include(seat => seat.User)
            .FirstOrDefaultAsync(seat =>
                seat.SubscriptionSeatId == seatId
                && seat.DeletedOn == null
                && seat.Status != CanceledStatus, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> GetOccupiedCountAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await BuildNonCanceledTenantQuery(tenantId)
            .CountAsync(seat => seat.UserId != null, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<SubscriptionSeat>> GetAvailableSeatsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await BuildNonCanceledTenantQuery(tenantId)
            .AsNoTracking()
            .Where(seat => seat.Status == ActiveStatus && seat.UserId == null)
            .OrderBy(seat => seat.SeatStartDate)
            .ThenBy(seat => seat.SubscriptionSeatId)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> GetTotalActiveCountAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await BuildNonCanceledTenantQuery(tenantId).CountAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> GetPendingCancellationCountAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await BuildNonCanceledTenantQuery(tenantId)
            .CountAsync(seat => seat.Status == PendingCancellationStatus, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task AddRangeAsync(IEnumerable<SubscriptionSeat> seats, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(seats);

        List<SubscriptionSeat> seatList = seats.ToList();
        if (seatList.Count == 0)
        {
            return;
        }

        _context.SubscriptionSeats.AddRange(seatList);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task UpdateAsync(SubscriptionSeat seat, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(seat);

        seat.ModifiedOn = DateTime.UtcNow;

        _context.SubscriptionSeats.Update(seat);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<SubscriptionSeat?> GetByUserAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default)
    {
        return await BuildNonCanceledTenantQuery(tenantId)
            .AsNoTracking()
            .Include(seat => seat.User)
            .FirstOrDefaultAsync(seat => seat.UserId == userId, cancellationToken);
    }

    private IQueryable<SubscriptionSeat> BuildNonCanceledTenantQuery(Guid tenantId)
    {
        return _context.SubscriptionSeats
            .Where(seat =>
                seat.TenantId == tenantId
                && seat.DeletedOn == null
                && seat.Status != CanceledStatus);
    }

    /// <inheritdoc/>
    public async Task<int> CancelAndSoftDeleteByTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        DateTimeOffset nowOffset = now;
        return await _context.SubscriptionSeats
            .Where(seat => seat.TenantId == tenantId && seat.DeletedOn == null && seat.Status != CanceledStatus)
            .ExecuteUpdateAsync(s => s
                .SetProperty(seat => seat.Status, CanceledStatus)
                .SetProperty(seat => seat.CanceledAt, (DateTimeOffset?)nowOffset)
                .SetProperty(seat => seat.DeletedOn, (DateTime?)now)
                .SetProperty(seat => seat.DeletedBy, (Guid?)deletedByUserId)
                .SetProperty(seat => seat.ModifiedOn, (DateTime?)now)
                .SetProperty(seat => seat.ModifiedBy, (Guid?)deletedByUserId), cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.SubscriptionSeats
            .Where(seat => seat.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> UnassignByUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;
        return await _context.SubscriptionSeats
            .Where(seat => seat.UserId == userId && seat.DeletedOn == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(seat => seat.UserId, (Guid?)null)
                .SetProperty(seat => seat.AssignedAt, (DateTimeOffset?)null)
                .SetProperty(seat => seat.ModifiedOn, (DateTime?)now), cancellationToken);
    }
}