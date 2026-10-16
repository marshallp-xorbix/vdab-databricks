using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Resolves the Databricks workspace URL for a stored workspace connection.
/// </summary>
public interface IDatabricksWorkspaceConnectionResolver
{
    /// <summary>
    /// Returns the workspace base URL for API calls, or a failure if the connection is missing or invalid.
    /// </summary>
    /// <param name="workspaceConnectionId">Databricks workspace connection ID.</param>
    Task<Result<string>> ResolveWorkspaceUrlAsync(int workspaceConnectionId);
}
