namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

/// <summary>
/// A SQL warehouse available in the workspace (for app resource binding).
/// </summary>
public class DatabricksSqlWarehouse
{
    public required string WarehouseId { get; set; }
    public required string Name { get; set; }
}
