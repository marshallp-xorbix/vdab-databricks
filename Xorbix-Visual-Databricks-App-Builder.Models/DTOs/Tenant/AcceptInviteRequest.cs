using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Request payload for the public invite-acceptance endpoint.
/// </summary>
public class AcceptInviteRequest
{
    /// <summary>The raw invite token delivered to the invitee.</summary>
    [Required]
    public required string Token { get; init; }
}
