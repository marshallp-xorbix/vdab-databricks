using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Reports;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;
using static System.Net.Mime.MediaTypeNames;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Provides aggregated reports for platform administrators. Restricted to
/// the <see cref="AuthPolicies.RequireAdministratorRole"/> policy.
/// </summary>
[Authorize(Policy = AuthPolicies.RequireAdministratorRole)]
[ApiController]
[Route("api/reports")]
public class ReportsController(
    IReportsService _reportsService,
    ILogger<ReportsController> _logger) : AuthenticatedControllerBase
{
    /// <summary>
    /// Returns a snapshot of high-level platform statistics for the administration dashboard.
    /// </summary>
    [HttpGet("stats")]
    [Produces(Application.Json)]
    [ProducesResponseType(typeof(ReportsStatsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ReportsStatsResponse>> GetStats(CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Administrator {UserId} requesting platform reports stats", userId);

        Result<ReportsStatsResponse> result = await _reportsService.GetStatsAsync(cancellationToken);
        if (result.IsFailed)
        {
            _logger.LogWarning("Reports stats request failed: {Errors}", string.Join(';', result.Errors.Select(e => e.Message)));
            return this.HandleFluentResult(result.ToResult());
        }

        return Ok(result.Value);
    }
}
