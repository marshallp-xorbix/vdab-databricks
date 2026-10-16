using System.Net.Mime;
using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Legal;
using Xorbix_Visual_Databricks_App_Builder.Server;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Serves sanitized legal page HTML fetched from the WordPress marketing site.
/// </summary>
[AllowAnonymous]
[EnableRateLimiting(RateLimitingPolicyNames.FeaturesAnonymous)]
[ApiController]
[Route("api/legal-pages")]
public class LegalPagesController(
    ILegalContentService legalContentService,
    ILogger<LegalPagesController> logger) : ControllerBase
{
    /// <summary>
    /// Returns sanitized HTML for a legal page by WordPress slug.
    /// </summary>
    /// <param name="slug">Allowed slug (e.g. privacy-policy, terms-and-conditions).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("{slug}")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(LegalPageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<LegalPageResponse>> GetBySlug(
        string slug,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Fetching legal page for slug {Slug}", slug);

        Result<LegalPageResponse> result =
            await legalContentService.GetPageBySlugAsync(slug, cancellationToken);
        return this.HandleFluentResult(result);
    }
}
