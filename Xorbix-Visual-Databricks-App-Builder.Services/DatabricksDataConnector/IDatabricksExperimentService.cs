using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// MLflow experiments for the data connector.
/// </summary>
public interface IDatabricksExperimentService
{
    /// <summary>
    /// List MLflow experiments in the workspace.
    /// </summary>
    Task<Result<List<DatabricksExperimentListItem>>> GetExperimentsAsync(Guid userId, int workspaceConnectionId);
}
