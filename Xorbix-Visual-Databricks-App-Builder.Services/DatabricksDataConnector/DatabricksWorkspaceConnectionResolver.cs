using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksWorkspaceConnectionResolver : IDatabricksWorkspaceConnectionResolver
{
    private readonly IDatabricksConnectionRepository _connectionRepository;
    private readonly ILogger<DatabricksWorkspaceConnectionResolver> _logger;

    public DatabricksWorkspaceConnectionResolver(
        IDatabricksConnectionRepository connectionRepository,
        ILogger<DatabricksWorkspaceConnectionResolver> logger)
    {
        _connectionRepository = connectionRepository;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<string>> ResolveWorkspaceUrlAsync(int workspaceConnectionId)
    {
        if (workspaceConnectionId <= 0)
        {
            return Result.Fail<string>("Workspace connection ID is required");
        }

        DatabricksConnection? connection = await _connectionRepository.GetByIdAsync(workspaceConnectionId);
        if (connection == null || string.IsNullOrWhiteSpace(connection.WorkspaceUrl))
        {
            _logger.LogError("Workspace connection not found. ConnectionId={ConnectionId}", workspaceConnectionId);
            return Result.Fail<string>("Workspace connection not found");
        }

        return Result.Ok(connection.WorkspaceUrl);
    }
}
