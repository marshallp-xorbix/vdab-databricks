namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

/// <summary>
/// One Lakebase database instance choice for Databricks Apps <c>database</c> resources.
/// Sourced from <c>/api/2.0/database/instances</c> (Lakebase OLTP), not Unity Catalog.
/// </summary>
public class LakebaseAppResourceDatabaseOption
{
    /// <summary>Lakebase instance name (API <c>name</c>).</summary>
    public string InstanceName { get; set; } = string.Empty;

    /// <summary>Postgres database name for the app resource payload (<c>database_name</c>).</summary>
    public string DatabaseName { get; set; } = string.Empty;
}
