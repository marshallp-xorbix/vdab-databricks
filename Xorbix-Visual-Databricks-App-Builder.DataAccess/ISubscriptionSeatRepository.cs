using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository interface for subscription seat data operations.
/// </summary>
public interface ISubscriptionSeatRepository
{
    /// <summary>
    /// Gets all non-canceled seats for a tenant with assigned user details.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>A collection of seats for the tenant.</returns>
    Task<IEnumerable<SubscriptionSeat>> GetByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a single non-canceled seat by its identifier.
    /// </summary>
    /// <param name="seatId">The seat identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The seat when found; otherwise null.</returns>
    Task<SubscriptionSeat?> GetByIdAsync(Guid seatId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts non-canceled seats that are currently occupied.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The occupied seat count.</returns>
    Task<int> GetOccupiedCountAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all available seats (active and unoccupied) for a tenant.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>A collection of available seats.</returns>
    Task<IEnumerable<SubscriptionSeat>> GetAvailableSeatsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts total non-canceled seats for a tenant.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The total active seat count.</returns>
    Task<int> GetTotalActiveCountAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts seats scheduled for period-end cancellation.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The pending cancellation seat count.</returns>
    Task<int> GetPendingCancellationCountAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds multiple seats in one persistence operation.
    /// </summary>
    /// <param name="seats">The seats to add.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task AddRangeAsync(IEnumerable<SubscriptionSeat> seats, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates a single seat.
    /// </summary>
    /// <param name="seat">The seat to update.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task UpdateAsync(SubscriptionSeat seat, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the non-canceled seat assigned to a specific user within a tenant.
    /// </summary>
    /// <param name="tenantId">The tenant identifier.</param>
    /// <param name="userId">The user identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The assigned seat when found; otherwise null.</returns>
    Task<SubscriptionSeat?> GetByUserAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks every non-canceled seat for a tenant as Canceled and soft-deletes the row.
    /// </summary>
    Task<int> CancelAndSoftDeleteByTenantAsync(Guid tenantId, Guid deletedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently removes every seat row for the given tenant.
    /// </summary>
    Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Unassigns every seat currently occupied by the given user across all tenants,
    /// preserving the tenant's paid seat allocation.
    /// </summary>
    Task<int> UnassignByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}