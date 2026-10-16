using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;
using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.RequireTenantMembership)]
[Route("api/[controller]")]
public class DatabricksController(
    IDeployService deployService,
    IDatabricksConnectionService connectorService,
    ILogger<DatabricksController> logger) : AuthenticatedControllerBase
{
    private readonly IDeployService _deployService = deployService;
    private readonly IDatabricksConnectionService _connectorService = connectorService;
    private readonly ILogger<DatabricksController> _logger = logger;

    [HttpPost("exchange-token")]
    public async Task<IActionResult> ExchangeToken([FromBody] OAuthCodeExchangeRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("Exchange-token endpoint hit for workspace: {Url}", request?.WorkspaceUrl);
        Result<string> result = await _connectorService.ExchangeTokenAsync(request!, tenantId);
        return this.HandleFluentResult(result);
    }

    [HttpPost("deploy")]
    public async Task<IActionResult> DeployApp([FromBody] SimpleDeployRequest request)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        _logger.LogInformation("Simple deployment for Databricks app: {DatabricksAppName}", request.DatabricksAppName);
        Result<DeployAppFromFolderResult> result = await _deployService.SimpleDeployAsync(request, userId, tenantId);
        return this.HandleFluentResult(result);
    }
}
