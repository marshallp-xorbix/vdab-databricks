using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Controller for managing application-level settings and roles.
/// </summary>
[Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
[ApiController]
[Route("api/[controller]")]
public class ManagementController(
    ILogger<ManagementController> _logger,
    IManagementService _managementService,
    IStripeEventLogService _stripeEventLogService) : AuthenticatedControllerBase
{
    /// <summary>
    /// Gets all roles in the application.
    /// </summary>
    /// <returns>List of role names.</returns>
    [HttpGet("roles")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<IEnumerable<string>>> GetRoles()
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("User {UserId} requesting list of all roles", userId);

        FluentResults.Result<IEnumerable<string>> result = await _managementService.GetRolesAsync();
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Adds a new role to the application.
    /// </summary>
    /// <param name="request">The role creation request.</param>
    /// <returns>The created role name.</returns>
    [HttpPost("roles")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<string>> AddRole([FromBody] AddRoleRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        FluentResults.Result<string> result = await _managementService.AddRoleAsync(request.RoleName, userId);

        if (result.IsSuccess)
        {
            return CreatedAtAction(nameof(GetRoles), new { roleName = result.Value }, result.Value);
        }

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Deletes a role from the application.
    /// </summary>
    /// <param name="roleName">The name of the role to delete.</param>
    /// <returns>No content on success.</returns>
    [HttpDelete("roles/{roleName}")]
    public async Task<IActionResult> RemoveRole(string roleName)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        FluentResults.Result result = await _managementService.RemoveRoleAsync(roleName, userId);

        if (result.IsSuccess)
        {
            return NoContent();
        }

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets paginated Stripe event logs for diagnostics.
    /// </summary>
    /// <param name="pageNumber">The 1-based page number (default 1).</param>
    /// <param name="pageSize">The page size (default 25).</param>
    /// <returns>A paginated Stripe event log response with total count.</returns>
    [HttpGet("stripe/event-logs")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<PaginatedStripeEventLogsResponse>> GetStripeEventLogs(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 25)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "Administrator {UserId} requesting Stripe event logs (pageNumber={PageNumber}, pageSize={PageSize})",
            userId,
            pageNumber,
            pageSize);

        FluentResults.Result<PaginatedStripeEventLogsResponse> result = await _stripeEventLogService
            .GetRecentAsync(pageNumber, pageSize);

        return this.HandleFluentResult(result);
    }
}
