using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing application-level settings and roles.
/// </summary>
public interface IManagementService
{
    /// <summary>
    /// Gets all roles in the application.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result containing the list of role names.</returns>
    Task<Result<IEnumerable<string>>> GetRolesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a new role to the application.
    /// </summary>
    /// <param name="roleName">The name of the role to create.</param>
    /// <param name="createdByUserId">The ID of the admin creating the role.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result containing the created role name.</returns>
    Task<Result<string>> AddRoleAsync(string roleName, Guid createdByUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a role from the application.
    /// </summary>
    /// <param name="roleName">The name of the role to delete.</param>
    /// <param name="deletedByUserId">The ID of the admin deleting the role.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> RemoveRoleAsync(string roleName, Guid deletedByUserId, CancellationToken cancellationToken = default);
}
