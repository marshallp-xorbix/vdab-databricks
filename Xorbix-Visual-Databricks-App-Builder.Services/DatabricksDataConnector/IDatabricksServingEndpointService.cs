using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Model serving endpoints for the data connector.
/// </summary>
public interface IDatabricksServingEndpointService
{
    /// <summary>
    /// List model serving endpoints in the workspace (names for app resource binding).
    /// </summary>
    Task<Result<List<DatabricksServingEndpointListItem>>> GetServingEndpointsAsync(Guid userId, int workspaceConnectionId);
}
