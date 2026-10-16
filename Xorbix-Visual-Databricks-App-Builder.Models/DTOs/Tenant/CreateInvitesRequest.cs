using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Request payload for creating one or more tenant invitations in a single batch.
/// </summary>
public class CreateInvitesRequest
{
    /// <summary>
    /// One or more email addresses to invite. Whitespace and casing are normalized server-side.
    /// </summary>
    [Required]
    [MinLength(1)]
    public required IList<string> Emails { get; init; }
}
