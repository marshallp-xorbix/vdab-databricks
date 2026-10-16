namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

public class BindingSchemaDto
{
    public required string Type { get; set; } // e.g., "unityCatalogTable"
    public required string Label { get; set; } // Display name: "Unity Catalog Table"
    public required string EditorType { get; set; } // Frontend editor component to use
    public Dictionary<string, object?>? DefaultConfig { get; set; }
}

