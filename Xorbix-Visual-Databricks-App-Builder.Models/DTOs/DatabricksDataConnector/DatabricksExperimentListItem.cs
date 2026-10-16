namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

/// <summary>
/// MLflow experiment for workspace pickers (app resources).
/// </summary>
public class DatabricksExperimentListItem
{
    public string ExperimentId { get; set; } = "";
    public string Name { get; set; } = "";
}
