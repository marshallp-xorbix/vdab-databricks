using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.FeatureManagement;
using System.Net.Mime;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Controller for feature management.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="FeaturesController"/> class.
/// </remarks>
[AllowAnonymous]
[EnableRateLimiting(RateLimitingPolicyNames.FeaturesAnonymous)]
[ApiController]
[Route("api/[controller]")]
public class FeaturesController(ILogger<FeaturesController> logger, IFeatureManager featureManager) : AuthenticatedControllerBase
{
    /// <summary>
    /// Checks if the EnablePreRelease feature is enabled. Create a separate endpoint for each feature flag to avoid confusion and ensure clear API design.
    /// </summary>
    /// <returns></returns>
    [HttpGet(FeatureManagementNames.EnablePreRelease)]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> Feature_EnablePreRelease()
    {
        try
        {
            var isEnabled = await featureManager.IsEnabledAsync(FeatureManagementNames.EnablePreRelease);
            return Ok(isEnabled);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error occurred while checking feature flag");
            return Ok(false);
        }
    }

    /// <summary>
    /// Catch-all endpoint for any undefined <code>features/{anything}</code>
    /// </summary>
    /// <param name="catchAll"></param>
    /// <returns></returns>
    [HttpGet("{*catchAll}")]
    public IActionResult HandleUnknownRoutes(string catchAll)
    {
        logger.LogWarning("Unhandled route: api/features/{CatchAll}", catchAll);
        return Ok(false);
    }
}