using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Facade for Databricks data connector operations (Unity Catalog, jobs, SQL warehouses, Lakebase, secrets, etc.).
/// </summary>
public interface IDatabricksDataConnectorService
{
    /// <summary>
    /// Get list of Unity Catalog tables accessible to the user
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <param name="catalog">Optional catalog name to filter tables</param>
    /// <param name="schema">Optional schema name to filter tables (requires catalog)</param>
    /// <returns>List of Unity Catalog tables with catalog, schema, and table information</returns>
    Task<Result<List<UnityCatalogTable>>> GetUnityCatalogTablesAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string? catalog = null, string? schema = null);

    /// <summary>
    /// Get list of Unity Catalog catalogs accessible to the user
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <returns>List of catalog names</returns>
    Task<Result<List<string>>> GetUnityCatalogCatalogsAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// Get list of Unity Catalog schemas for a specific catalog
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <param name="catalog">Catalog name</param>
    /// <returns>List of schema names</returns>
    Task<Result<List<string>>> GetUnityCatalogSchemasAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string catalog);

    /// <summary>
    /// Get list of Unity Catalog volumes for a specific catalog and schema
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <param name="catalog">Catalog name</param>
    /// <param name="schema">Schema name</param>
    /// <returns>List of volume names</returns>
    Task<Result<List<string>>> GetUnityCatalogVolumesAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string catalog, string schema);

    /// <summary>
    /// Get list of Databricks Jobs accessible to the user
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <returns>List of Databricks jobs with job ID and name</returns>
    Task<Result<List<DatabricksJob>>> GetJobsAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// Get SQL warehouses accessible to the user (for app resource binding).
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <returns>List of warehouses with id and display name</returns>
    Task<Result<List<DatabricksSqlWarehouse>>> GetSqlWarehousesAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// Get list of Lakebase database instances accessible to the user
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <returns>List of Lakebase database instances</returns>
    Task<Result<List<LakebaseDatabaseInstance>>> GetDatabaseInstancesAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// Get Lakebase database catalog metadata for a given catalog name.
    /// Calls the Databricks /api/2.0/database/catalogs/{catalogName} endpoint and returns the result
    /// as a single-item list so callers can use standard resolution helpers.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <param name="catalogName">The Unity Catalog catalog name to look up (matches the <c>name</c> field in the Databricks response).</param>
    /// <returns>Single-item list containing the matched Lakebase database catalog</returns>
    Task<Result<List<LakebaseDatabaseCatalog>>> GetLakebaseDatabaseCatalogsAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string catalogName);

    /// <summary>
    /// Lakebase database instances for Databricks Apps <c>database</c> resources, from
    /// <c>/api/2.0/database/instances</c> (not Unity Catalog). Optional per-instance GET fills <c>database_name</c> when missing from list.
    /// </summary>
    Task<Result<List<LakebaseAppResourceDatabaseOption>>> GetLakebaseAppResourceDatabaseOptionsAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// Read-only selector data for Lakebase Autoscaling projects, branches, and endpoints.
    /// </summary>
    Task<Result<LakebaseAutoscalingSelectorResponse>> GetLakebaseAutoscalingSelectorAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// Lists the real Postgres database names on a Lakebase Autoscaling branch.
    /// </summary>
    Task<Result<List<string>>> GetLakebaseAutoscalingDatabasesAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId,
        string projectId,
        string branchId);

    /// <summary>
    /// Lists schemas inside the selected Lakebase Autoscaling branch database.
    /// </summary>
    Task<Result<List<string>>> GetLakebaseAutoscalingSchemasAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName);

    /// <summary>
    /// Lists tables inside the selected Lakebase Autoscaling branch database schema.
    /// </summary>
    Task<Result<List<UnityCatalogTable>>> GetLakebaseAutoscalingTablesAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName,
        string schema);

    /// <summary>
    /// Gets column details for a table inside the selected Lakebase Autoscaling branch database schema.
    /// </summary>
    Task<Result<UnityCatalogTableDetails>> GetLakebaseAutoscalingTableDetailsAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName,
        string schema,
        string table);

    /// <summary>
    /// Get detailed information about a specific Unity Catalog table including columns
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID</param>
    /// <param name="catalog">Catalog name</param>
    /// <param name="schema">Schema name</param>
    /// <param name="table">Table name</param>
    /// <returns>Detailed table information including columns</returns>
    Task<Result<UnityCatalogTableDetails>> GetUnityCatalogTableDetailsAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string catalog, string schema, string table);

    /// <summary>
    /// List model serving endpoints in the workspace (names for app resource binding).
    /// </summary>
    Task<Result<List<DatabricksServingEndpointListItem>>> GetServingEndpointsAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// List MLflow experiments in the workspace (Databricks Experiments API: <c>/api/2.0/mlflow/experiments/search</c>, with fallback to <c>.../list</c> on older workspaces).
    /// </summary>
    Task<Result<List<DatabricksExperimentListItem>>> GetExperimentsAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// List Genie spaces in the workspace.
    /// </summary>
    Task<Result<List<DatabricksGenieSpaceListItem>>> GetGenieSpacesAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// List secret scope names in the workspace.
    /// </summary>
    Task<Result<List<string>>> GetSecretScopesAsync(Guid userId, Guid tenantId, int workspaceConnectionId);

    /// <summary>
    /// List secret key names within a scope (Secrets API). The calling principal needs LIST on the scope; see Databricks secret scope permissions.
    /// </summary>
    Task<Result<List<string>>> GetSecretKeysAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string scope);
}
