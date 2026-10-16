namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

public class LakebaseDatabaseInstance
{
    public string? Name { get; set; }
    public string? ReadWriteDns { get; set; }
    /// <summary>Postgres database name when returned by the Database Instances API.</summary>
    public string? DatabaseName { get; set; }
}
