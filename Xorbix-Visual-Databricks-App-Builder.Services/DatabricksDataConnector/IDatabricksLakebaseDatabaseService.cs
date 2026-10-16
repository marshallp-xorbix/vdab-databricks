using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Lakebase / database instances API for the data connector.
/// </summary>
public interface IDatabricksLakebaseDatabaseService
{
    /// <summary>
    /// Get list of Lakebase database instances accessible to the user.
    /// </summary>
    Task<Result<List<LakebaseDatabaseInstance>>> GetDatabaseInstancesAsync(Guid userId, int workspaceConnectionId);

    /// <summary>
    /// Get Lakebase database catalog metadata for a given catalog name.
    /// </summary>
    Task<Result<List<LakebaseDatabaseCatalog>>> GetLakebaseDatabaseCatalogsAsync(Guid userId, int workspaceConnectionId, string catalogName);

    /// <summary>
    /// Lakebase database instances for Databricks Apps database resources.
    /// </summary>
    Task<Result<List<LakebaseAppResourceDatabaseOption>>> GetLakebaseAppResourceDatabaseOptionsAsync(Guid userId, int workspaceConnectionId);

    /// <summary>
    /// Read-only selector data for Lakebase Autoscaling resources (projects, branches, and endpoints).
    /// </summary>
    Task<Result<LakebaseAutoscalingSelectorResponse>> GetLakebaseAutoscalingSelectorAsync(Guid userId, int workspaceConnectionId);

    /// <summary>
    /// Lists the real Postgres database names on a Lakebase Autoscaling branch.
    /// </summary>
    Task<Result<List<string>>> GetLakebaseAutoscalingDatabasesAsync(
        Guid userId,
        int workspaceConnectionId,
        string projectId,
        string branchId);

    /// <summary>
    /// Lists schemas inside the selected Lakebase Autoscaling branch database.
    /// </summary>
    Task<Result<List<string>>> GetLakebaseAutoscalingSchemasAsync(
        Guid userId,
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
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName,
        string schema,
        string table);
}
