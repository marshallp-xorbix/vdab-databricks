using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.RequireTenantMembership)]
[Route("api/[controller]")]
public class CodeController(IDeployService deployService, ILogger<CodeController> logger) : AuthenticatedControllerBase
{
    private readonly IDeployService _deployService = deployService;
    private readonly ILogger<CodeController> _logger = logger;

    [HttpGet("prebuilt-modules-library")]
    [Produces("text/plain")]
    public ActionResult<string> GetPrebuiltModulesLibrary()
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid _);
        if (authFailure is not null)
        {
            return authFailure;
        }

        return Content(PrebuiltModulesLibrary.GetContent(), "text/plain; charset=utf-8");
    }

    [HttpPost("preview")]
    [Produces(typeof(GeneratedCodePreviewResult))]
    public async Task<ActionResult<GeneratedCodePreviewResult>> Preview([FromBody] GeneratedCodePreviewRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("Generated code preview requested for user {UserId}, app {AppId}", userId, request.AppId);
        Result<GeneratedCodePreviewResult> result = await _deployService.PreviewGeneratedCodeAsync(request, userId, tenantId);
        return this.HandleFluentResult(result);
    }
}
