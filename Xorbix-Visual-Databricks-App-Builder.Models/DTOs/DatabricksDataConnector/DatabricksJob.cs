namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

/// <summary>
/// Represents a Databricks Job
/// </summary>
public class DatabricksJob
{
    public required string JobId { get; set; }
    public required string JobName { get; set; }
    public string? CreatorUserName { get; set; }
    public string? JobType { get; set; }
}
