using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Shared seat-assignment clearing so membership suspend and seat-management paths
/// stay in sync (including nulling the User navigation for detached EF updates).
/// </summary>
internal static class SubscriptionSeatAssignment
{
    /// <summary>
    /// Clears the user assignment on a seat. Also nulls the navigation property so EF Core
    /// does not restore <see cref="SubscriptionSeat.UserId"/> from an eagerly-loaded
    /// <see cref="SubscriptionSeat.User"/> when updating a detached entity.
    /// </summary>
    /// <param name="seat">The seat whose assignment should be cleared.</param>
    public static void Clear(SubscriptionSeat seat)
    {
        seat.UserId = null;
        seat.AssignedAt = null;
        seat.User = null;
    }
}
