namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Result of confirming a prior-member invite choice.
/// </summary>
public class PriorMemberChoiceResponse
{
    /// <summary>The choice that was applied.</summary>
    public required PriorMemberChoice Choice { get; init; }

    /// <summary>
    /// Populated when an older client expected an immediate membership restore.
    /// ReAdd now sends an invite; prefer <see cref="InviteResponse"/>.
    /// </summary>
    public TenantMemberRoleResponse? RestoredMembership { get; init; }

    /// <summary>
    /// Populated for ReAdd (restore invite created) and DifferentPerson (retire + new invite).
    /// </summary>
    public CreateInvitesResponse? InviteResponse { get; init; }
}
