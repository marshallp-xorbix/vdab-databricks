using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Shared rule for whether an Ended membership may still be restored in-window.
/// </summary>
public static class MembershipReinstatementPolicy
{
    /// <summary>
    /// Returns success when the membership is still within the reinstatement window,
    /// or when the window is disabled (<paramref name="reinstatementDays"/> ≤ 0).
    /// </summary>
    public static Result EnsureWithinWindow(UserTenantMembership membership, int reinstatementDays)
    {
        if (membership.DeletedOn is DateTime endedOn
            && reinstatementDays > 0
            && endedOn.AddDays(reinstatementDays) < DateTime.UtcNow)
        {
            return Result.Fail(new GoneError(
                $"This membership can no longer be restored. The reinstatement window of {reinstatementDays} days has expired."));
        }

        return Result.Ok();
    }
}
