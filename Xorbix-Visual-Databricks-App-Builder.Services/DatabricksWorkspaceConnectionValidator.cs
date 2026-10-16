using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public sealed class DatabricksWorkspaceConnectionValidator : IDatabricksWorkspaceConnectionValidator
{
    private readonly IDatabricksConnectionRepository _connectionRepository;

    public DatabricksWorkspaceConnectionValidator(IDatabricksConnectionRepository connectionRepository)
    {
        _connectionRepository = connectionRepository;
    }

    /// <inheritdoc/>
    public async Task<Result<DatabricksConnection>> ValidateWorkspaceConnectionForTenantAsync(
        Guid tenantId,
        int workspaceConnectionId)
    {
        DatabricksConnection? connection = await _connectionRepository.GetByIdAsync(workspaceConnectionId);
        if (connection == null)
        {
            return Result.Fail<DatabricksConnection>(new BadRequestError("Workspace connection not found."));
        }

        if (string.IsNullOrWhiteSpace(connection.WorkspaceUrl))
        {
            return Result.Fail<DatabricksConnection>(new BadRequestError("Workspace URL is missing."));
        }

        if (!connection.TenantId.HasValue || connection.TenantId.Value != tenantId)
        {
            return Result.Fail<DatabricksConnection>(new BadRequestError("Workspace connection is not available for this tenant."));
        }

        return Result.Ok(connection);
    }
}
