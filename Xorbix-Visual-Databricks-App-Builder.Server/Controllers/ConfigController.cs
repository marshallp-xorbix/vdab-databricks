using System.Net.Mime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Config;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Serves non-secret, per-environment configuration to the browser SPA at startup. Because these values are
/// resolved at runtime rather than baked into the build, one build artifact is promoted unchanged across
/// dev/stg/prd. Anonymous because the SPA loads it before the user authenticates.
/// </summary>
[AllowAnonymous]
[ApiController]
[Route("api/config")]
public class ConfigController(
    IConfiguration configuration,
    IOptions<AuthenticationConfiguration> authenticationOptions,
    IOptions<AccountLifecycleConfiguration> accountLifecycleOptions) : ControllerBase
{
    /// <summary>
    /// Returns the runtime client configuration for the current environment.
    /// </summary>
    /// <returns>The client configuration (Application Insights connection string and authentication mode).</returns>
    [HttpGet]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<ClientConfigResponse> GetClientConfig()
    {
        ClientConfigResponse response = new()
        {
            ApplicationInsightsConnectionString = configuration.GetConnectionString("ApplicationInsights"),
            PasswordlessOnly = authenticationOptions.Value.PasswordlessOnly,
            MembershipReinstatementDays = accountLifecycleOptions.Value.MembershipReinstatementDays,
        };

        return Ok(response);
    }
}
