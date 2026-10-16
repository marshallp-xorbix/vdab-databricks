using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Middleware;

/// <summary>
/// Middleware to add user context (UserId, Jti) to the logging scope.
/// </summary>
public class LogContextMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<LogContextMiddleware> _logger;

    public LogContextMiddleware(RequestDelegate next, ILogger<LogContextMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var jti = context.User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value ??
                  context.User.FindFirst("jti")?.Value;

        if (userId != null || jti != null)
        {
            var scopeState = new Dictionary<string, object>();

            if (userId != null)
            {
                scopeState["UserId"] = userId;
            }

            if (jti != null)
            {
                scopeState["Jti"] = jti;
            }

            using (_logger.BeginScope(scopeState))
            {
                await _next(context);
            }
        }
        else
        {
            await _next(context);
        }
    }
}
