using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Request to extend a tenant's trial. Global-administrator only.
/// </summary>
public class ExtendTrialRequest
{
    /// <summary>
    /// The new trial end timestamp (UTC). Must be in the future and later than the current trial end.
    /// </summary>
    [Required(ErrorMessage = "New trial end date is required")]
    public required DateTimeOffset NewTrialEndDate { get; init; }
}
