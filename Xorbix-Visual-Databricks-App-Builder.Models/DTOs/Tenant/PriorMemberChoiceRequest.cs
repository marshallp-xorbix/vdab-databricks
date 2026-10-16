namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Confirms Re-add vs Different person for a prior Detached member (§11.1).
/// </summary>
public class PriorMemberChoiceRequest
{
    /// <summary>Email address that returned <see cref="InviteOutcome.PriorMemberChoiceRequired"/>.</summary>
    public required string Email { get; init; }

    /// <summary>Admin choice.</summary>
    public required PriorMemberChoice Choice { get; init; }
}
