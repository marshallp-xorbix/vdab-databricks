namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Canonical subscription seat status values stored on <c>SubscriptionSeat.Status</c>.
/// </summary>
public static class SubscriptionSeatStatuses
{
    /// <summary>Seat is active and may be assigned.</summary>
    public const string Active = "Active";

    /// <summary>Seat is pending cancellation at period end.</summary>
    public const string PendingCancellation = "PendingCancellation";

    /// <summary>Seat has been canceled.</summary>
    public const string Canceled = "Canceled";
}
