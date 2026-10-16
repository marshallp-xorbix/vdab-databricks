using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Manages tenant subscription seat lifecycle and Stripe quantity synchronization.
/// </summary>
public interface ISeatManagementService
{
    /// <summary>
    /// Creates initial bundled seats for a newly created subscription.
    /// Individual creates exactly one bundled seat assigned to the creator.
    /// Team creates minimum bundled seats with the first assigned to the creator.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="tier">Subscription tier name.</param>
    /// <param name="creatorUserId">Creator user identifier for initial assignment.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The number of seats created, or failure.</returns>
    Task<Result<int>> InitializeSeatsForSubscriptionAsync(Guid tenantId, string tier, Guid creatorUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns seat summary counts for a tenant.
    /// Reads succeed for every tier (Individual included). Seat mutations remain Team/allowlist gated.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Seat summary.</returns>
    Task<Result<SeatSummaryDto>> GetSeatSummaryAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns all non-canceled seats for a tenant with occupant information.
    /// Reads succeed for every tier so Individual's single seat (and any stored seats) are visible
    /// to administrators. Seat mutations remain Team/allowlist gated.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Tenant seat list.</returns>
    Task<Result<IList<SeatDto>>> GetSeatsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Best-effort assignment of an existing open seat to a tenant member when seat management
    /// is allowed for the tenant. Never purchases seats or changes Stripe quantity. Succeeds
    /// (no-op) when seat management is unavailable, no open seat exists, or the user already
    /// has a seat — membership addition must not fail because of seating.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="userId">User identifier that already belongs to the tenant.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Always a successful result unless the operation is canceled.</returns>
    Task<Result> TryAssignOpenSeatIfAllowedAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Assigns a user to an available seat.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="seatId">Seat identifier.</param>
    /// <param name="userId">User identifier to assign.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated seat state.</returns>
    Task<Result<SeatDto>> AssignSeatAsync(Guid tenantId, Guid seatId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Unassigns the current user from a seat.
    /// Optional cancellation is allowed only for extra seats and is deferred to period end.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="seatId">Seat identifier.</param>
    /// <param name="cancelExtraSeat">True to schedule extra seat cancellation at period end.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated seat state.</returns>
    Task<Result<SeatDto>> UnassignSeatAsync(Guid tenantId, Guid seatId, bool cancelExtraSeat, CancellationToken cancellationToken = default);

    /// <summary>
    /// Transfers a seat assignment to another user without changing billing quantity.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="seatId">Seat identifier.</param>
    /// <param name="newUserId">User identifier for the new assignee.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated seat state.</returns>
    Task<Result<SeatDto>> TransferSeatAsync(Guid tenantId, Guid seatId, Guid newUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Purchases additional extra seats and updates Stripe subscription quantity with proration.
    /// Created seats are unoccupied.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="count">Number of seats to add.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Created seat records.</returns>
    Task<Result<IList<SeatDto>>> PurchaseAdditionalSeatsAsync(Guid tenantId, int count, CancellationToken cancellationToken = default);

    /// <summary>
    /// Increases the Stripe subscription seat quantity by one (with proration) ahead of an
    /// over-allotment seat purchase, without writing any local seat state. Intended to be called
    /// <b>before</b> and <b>outside</b> any database transaction so a billing decline aborts
    /// cleanly with nothing to roll back and no transaction is held open across the Stripe call.
    /// The caller materializes the local seat separately via
    /// <see cref="MaterializePurchasedSeatAsync"/> once this succeeds.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success when the Stripe quantity was increased; otherwise a failure.</returns>
    Task<Result> IncreaseSeatQuantityForPurchaseAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates and assigns a single active seat to the given user and recomputes the tenant's
    /// effective limits, without calling Stripe. Pairs with
    /// <see cref="IncreaseSeatQuantityForPurchaseAsync"/>: the Stripe quantity is increased first
    /// (outside any transaction), then this records the local seat within the caller's ambient
    /// transaction so it commits atomically with the rest of the accept flow.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="userId">User identifier to assign the new seat to.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The created and assigned seat, or a failure when the seat could not be recorded.</returns>
    Task<Result<SeatDto>> MaterializePurchasedSeatAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Schedules unoccupied extra seats for cancellation at the end of the current billing period.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="count">Number of extra seats to schedule for cancellation.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated seats scheduled for cancellation.</returns>
    Task<Result<IList<SeatDto>>> RemoveExtraSeatsAsync(Guid tenantId, int count, CancellationToken cancellationToken = default);

    /// <summary>
    /// Previews proration impact for a seat quantity change.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="seatDelta">Seat quantity delta (positive or negative).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Proration preview details.</returns>
    Task<Result<SeatPreviewDto>> PreviewSeatChangeAsync(Guid tenantId, int seatDelta, CancellationToken cancellationToken = default);

    /// <summary>
    /// Finalizes pending seat cancellations after billing period renewal and syncs Stripe quantity.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Number of seats finalized as canceled.</returns>
    Task<Result<int>> ProcessPeriodEndCancellationsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes the assigned user from a seat and revokes their tenant membership.
    /// The seat remains Active and becomes available for assignment.
    /// If the user's home tenant equals the supplied tenant, ownership is transferred to the
    /// first tenant they still belong to; if no membership remains, the account stays active
    /// with a cleared home tenant so the user can sign in again and choose a plan or accept an invite.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="seatId">Seat identifier.</param>
    /// <param name="performedByUserId">User performing the removal (for audit fields).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated seat state.</returns>
    Task<Result<SeatDto>> RemoveUserFromSeatAsync(Guid tenantId, Guid seatId, Guid performedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a member from a tenant by user id, freeing any occupied seat (the seat stays
    /// available for reassignment). Ends the membership only — never writes account fields.
    /// Sessions and Databricks tokens for this tenant are always revoked after commit.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="userId">The member to remove.</param>
    /// <param name="performedByUserId">User performing the removal (for audit fields).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A successful result when the member is removed; otherwise a failure.</returns>
    Task<Result> RemoveMemberAsync(Guid tenantId, Guid userId, Guid performedByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Schedules a single extra seat for cancellation at the end of the current billing period.
    /// Bundled seats are rejected; reduce the plan minimum to remove bundled seats.
    /// The assigned user retains access until the seat is finalized at period end.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="seatId">Seat identifier.</param>
    /// <param name="performedByUserId">User performing the removal (for audit fields).</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Updated seat state.</returns>
    Task<Result<SeatDto>> RemoveSeatAndUserAsync(Guid tenantId, Guid seatId, Guid performedByUserId, CancellationToken cancellationToken = default);
}