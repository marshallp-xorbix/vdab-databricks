using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Databricks SQL warehouses for the data connector.
/// </summary>
public interface IDatabricksSqlWarehouseService
{
    /// <summary>
    /// Get SQL warehouses accessible to the user (for app resource binding).
    /// </summary>
    Task<Result<List<DatabricksSqlWarehouse>>> GetSqlWarehousesAsync(Guid userId, int workspaceConnectionId);
}
