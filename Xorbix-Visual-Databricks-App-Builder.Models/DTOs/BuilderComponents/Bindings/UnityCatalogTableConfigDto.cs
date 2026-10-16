using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

public class UnityCatalogTableConfigDto
{
    public string BindingType { get; set; } = "single"; // "single" | "join" (future)
    public string? Catalog { get; set; }
    public string? Schema { get; set; }
    public string? Table { get; set; }
    public List<UnityCatalogColumn>? Columns { get; set; }
}

