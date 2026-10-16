using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Databricks Jobs API for the data connector.
/// </summary>
public interface IDatabricksJobService
{
    /// <summary>
    /// Get list of Databricks Jobs accessible to the user.
    /// </summary>
    Task<Result<List<DatabricksJob>>> GetJobsAsync(Guid userId, int workspaceConnectionId);
}
