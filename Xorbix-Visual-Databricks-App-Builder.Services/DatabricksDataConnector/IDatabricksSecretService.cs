using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Databricks secrets API for the data connector.
/// </summary>
public interface IDatabricksSecretService
{
    /// <summary>
    /// List secret scope names in the workspace.
    /// </summary>
    Task<Result<List<string>>> GetSecretScopesAsync(Guid userId, int workspaceConnectionId);

    /// <summary>
    /// List secret key names within a scope (Secrets API).
    /// </summary>
    Task<Result<List<string>>> GetSecretKeysAsync(Guid userId, int workspaceConnectionId, string scope);
}
