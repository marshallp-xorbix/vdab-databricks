namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

/// <summary>
/// Represents a column in a Unity Catalog table
/// </summary>
public class UnityCatalogColumn
{
    /// <summary>
    /// The column name
    /// </summary>
    public string? Name { get; set; }
    
    /// <summary>
    /// The column data type
    /// </summary>
    public string? Type { get; set; }
    
    /// <summary>
    /// Whether the column is nullable
    /// </summary>
    public bool? Nullable { get; set; }
    
    /// <summary>
    /// The column comment/description
    /// </summary>
    public string? Comment { get; set; }
}

