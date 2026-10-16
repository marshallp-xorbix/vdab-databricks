namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

/// <summary>
/// Represents detailed information about a Unity Catalog table including its columns
/// </summary>
public class UnityCatalogTableDetails
{
    /// <summary>
    /// The catalog name
    /// </summary>
    public string? CatalogName { get; set; }
    
    /// <summary>
    /// The schema name
    /// </summary>
    public string? SchemaName { get; set; }
    
    /// <summary>
    /// The table name
    /// </summary>
    public string? Name { get; set; }
    
    /// <summary>
    /// The full table name (catalog.schema.table)
    /// </summary>
    public string? FullName { get; set; }
    
    /// <summary>
    /// List of columns in the table
    /// </summary>
    public List<UnityCatalogColumn>? Columns { get; set; }
}

