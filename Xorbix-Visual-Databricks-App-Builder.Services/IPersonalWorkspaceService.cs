using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// User-initiated personal workspace (Incomplete registration tenant) creation for Detached accounts.
/// </summary>
public interface IPersonalWorkspaceService
{
    /// <summary>
    /// Creates an Incomplete personal tenant and membership for the authenticated user when they
    /// have no live memberships. Does not clear <c>DeletedOn</c> and does not write
    /// <c>ApplicationUser.TenantId</c>.
    /// </summary>
    /// <param name="userId">The authenticated user requesting a workspace.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>The created tenant on success; Conflict when the user already has a live membership.</returns>
    Task<Result<TenantDto>> CreatePersonalWorkspaceAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}
