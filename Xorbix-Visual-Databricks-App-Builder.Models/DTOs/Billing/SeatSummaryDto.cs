namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Aggregated seat counts for a tenant.
/// </summary>
public class SeatSummaryDto
{
    /// <summary>
    /// Total number of non-canceled seats.
    /// </summary>
    public required int TotalSeats { get; init; }

    /// <summary>
    /// Number of occupied non-canceled seats.
    /// </summary>
    public required int OccupiedSeats { get; init; }

    /// <summary>
    /// Number of active unoccupied seats.
    /// </summary>
    public required int AvailableSeats { get; init; }

    /// <summary>
    /// Number of bundled seats included in base tier pricing.
    /// </summary>
    public required int BundledSeats { get; init; }

    /// <summary>
    /// Number of extra purchased seats.
    /// </summary>
    public required int ExtraSeats { get; init; }

    /// <summary>
    /// Number of seats scheduled for period-end cancellation.
    /// </summary>
    public required int PendingCancellationSeats { get; init; }
}