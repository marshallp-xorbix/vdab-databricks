using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing application-level settings and roles.
/// </summary>
public class ManagementService : IManagementService
{
    private readonly ILogger<ManagementService> _logger;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="ManagementService"/> class.
    /// </summary>
    /// <param name="logger">Logger instance.</param>
    /// <param name="roleManager">Role manager instance.</param>
    public ManagementService(
        ILogger<ManagementService> logger,
        RoleManager<IdentityRole<Guid>> roleManager)
    {
        _logger = logger;
        _roleManager = roleManager;
    }

    /// <inheritdoc/>
    public async Task<Result<IEnumerable<string>>> GetRolesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var roles = await _roleManager.Roles
                .Select(r => r.Name!)
                .OrderBy(r => r)
                .ToListAsync(cancellationToken);

            return Result.Ok<IEnumerable<string>>(roles);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving roles");
            return Result.Fail<IEnumerable<string>>($"Error retrieving roles: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<string>> AddRoleAsync(string roleName, Guid createdByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(roleName))
            {
                _logger.LogWarning("User {UserId} attempted to add role with empty name", createdByUserId);
                return Result.Fail<string>(new BadRequestError("Role name is required"));
            }

            _logger.LogInformation("User {UserId} attempting to add role {RoleName}", createdByUserId, roleName);

            // Check if role already exists
            var roleExists = await _roleManager.RoleExistsAsync(roleName);
            if (roleExists)
            {
                _logger.LogWarning("User {UserId} attempted to add existing role {RoleName}", createdByUserId, roleName);
                return Result.Fail<string>(new ConflictError($"Role '{roleName}' already exists"));
            }

            // Create new role
            var role = new IdentityRole<Guid>(roleName);
            var result = await _roleManager.CreateAsync(role);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to create role {RoleName}: {Errors}", roleName, errors);
                return Result.Fail<string>($"Failed to create role: {errors}");
            }

            _logger.LogInformation("User {UserId} successfully created role {RoleName}", createdByUserId, roleName);
            return Result.Ok(roleName);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating role {RoleName}", roleName);
            return Result.Fail<string>($"Error creating role: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> RemoveRoleAsync(string roleName, Guid deletedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(roleName))
            {
                _logger.LogWarning("User {UserId} attempted to remove role with empty name", deletedByUserId);
                return Result.Fail(new BadRequestError("Role name is required"));
            }

            _logger.LogInformation("User {UserId} attempting to remove role {RoleName}", deletedByUserId, roleName);

            // Prevent deletion of system roles
            var systemRoles = new[] { AuthRoles.Administrator, AuthRoles.TenantAdmin, AuthRoles.Developer };
            if (systemRoles.Contains(roleName, StringComparer.OrdinalIgnoreCase))
            {
                _logger.LogWarning("User {UserId} attempted to remove system role {RoleName}", deletedByUserId, roleName);
                return Result.Fail(new BadRequestError($"Cannot delete system role '{roleName}'"));
            }

            // Find role
            var role = await _roleManager.FindByNameAsync(roleName);
            if (role == null)
            {
                _logger.LogWarning("User {UserId} attempted to remove non-existent role {RoleName}", deletedByUserId, roleName);
                return Result.Fail(new NotFoundError($"Role '{roleName}' not found"));
            }

            // Delete role
            var result = await _roleManager.DeleteAsync(role);
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to delete role {RoleName}: {Errors}", roleName, errors);
                return Result.Fail($"Failed to delete role: {errors}");
            }

            _logger.LogInformation("User {UserId} successfully deleted role {RoleName}", deletedByUserId, roleName);
            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting role {RoleName}", roleName);
            return Result.Fail($"Error deleting role: {ex.Message}");
        }
    }
}
