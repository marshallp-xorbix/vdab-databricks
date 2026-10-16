namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;

/// <summary>
/// Response DTO for Databricks app compute status.
/// </summary>
public class AppStatusResponse
{
    /// <summary>
    /// The compute status state [DEPLOYED, RUNNING, CRASHED, or UNAVAILABLE].
    /// </summary>
    public string State { get; set; } = string.Empty;

    /// <summary>
    /// Optional status message from Databricks.
    /// </summary>
    public string Message { get; set; } = string.Empty;
}
