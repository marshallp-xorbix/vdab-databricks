using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Unity Catalog listing and table metadata for the data connector.
/// </summary>
public interface IDatabricksUnityCatalogService
{
    /// <summary>
    /// Get list of Unity Catalog tables accessible to the user.
    /// </summary>
    Task<Result<List<UnityCatalogTable>>> GetUnityCatalogTablesAsync(Guid userId, int workspaceConnectionId, string? catalog = null, string? schema = null);

    /// <summary>
    /// Get list of Unity Catalog catalogs accessible to the user.
    /// </summary>
    Task<Result<List<string>>> GetUnityCatalogCatalogsAsync(Guid userId, int workspaceConnectionId);

    /// <summary>
    /// Get list of Unity Catalog schemas for a specific catalog.
    /// </summary>
    Task<Result<List<string>>> GetUnityCatalogSchemasAsync(Guid userId, int workspaceConnectionId, string catalog);

    /// <summary>
    /// Get list of Unity Catalog volumes for a specific catalog and schema.
    /// </summary>
    Task<Result<List<string>>> GetUnityCatalogVolumesAsync(Guid userId, int workspaceConnectionId, string catalog, string schema);

    /// <summary>
    /// Get detailed information about a specific Unity Catalog table including columns.
    /// </summary>
    Task<Result<UnityCatalogTableDetails>> GetUnityCatalogTableDetailsAsync(Guid userId, int workspaceConnectionId, string catalog, string schema, string table);
}
