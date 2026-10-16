namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Represents a single subscription seat and its current assignment state.
/// </summary>
public class SeatDto
{
    /// <summary>
    /// Unique identifier of the seat.
    /// </summary>
    public required Guid SeatId { get; init; }

    /// <summary>
    /// Assigned user identifier. Null means the seat is currently unoccupied.
    /// </summary>
    public Guid? UserId { get; init; }

    /// <summary>
    /// Assigned user email when occupied.
    /// </summary>
    public string? UserEmail { get; init; }

    /// <summary>
    /// Assigned user display name when occupied.
    /// </summary>
    public string? UserDisplayName { get; init; }

    /// <summary>
    /// Current seat status (Active, PendingCancellation, Canceled).
    /// </summary>
    public required string Status { get; init; }

    /// <summary>
    /// True when this seat is included in the tier minimum; false when purchased as extra.
    /// </summary>
    public required bool IsBundled { get; init; }

    /// <summary>
    /// Seat activation or purchase timestamp.
    /// </summary>
    public required DateTimeOffset SeatStartDate { get; init; }

    /// <summary>
    /// Scheduled or actual seat end timestamp.
    /// </summary>
    public DateTimeOffset? SeatEndDate { get; init; }

    /// <summary>
    /// Timestamp when a user was assigned to this seat.
    /// </summary>
    public DateTimeOffset? AssignedAt { get; init; }

    /// <summary>
    /// Timestamp when cancellation was requested.
    /// </summary>
    public DateTimeOffset? CanceledAt { get; init; }
}