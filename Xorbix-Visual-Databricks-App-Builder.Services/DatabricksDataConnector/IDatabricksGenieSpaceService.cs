using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Genie spaces for the data connector.
/// </summary>
public interface IDatabricksGenieSpaceService
{
    /// <summary>
    /// List Genie spaces in the workspace.
    /// </summary>
    Task<Result<List<DatabricksGenieSpaceListItem>>> GetGenieSpacesAsync(Guid userId, int workspaceConnectionId);
}
