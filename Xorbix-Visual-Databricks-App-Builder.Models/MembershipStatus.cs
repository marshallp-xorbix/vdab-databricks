namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Lifecycle of a user's membership in a single tenant (§9.1). Distinct from account
/// <see cref="EF.ApplicationUser"/> state — tenant admins control this axis only.
/// </summary>
public enum MembershipStatus
{
    /// <summary>Normal member of this tenant; may hold a seat and access the workspace.</summary>
    Active = 0,

    /// <summary>
    /// Temporarily blocked by this tenant's admin. Access grant retained, dormant.
    /// Seat released. Does not soft-delete the row.
    /// </summary>
    Suspended = 1,

    /// <summary>
    /// Removed. Soft-deleted (<c>DeletedOn</c> set) and retained for the reinstatement window.
    /// </summary>
    Ended = 2,
}
