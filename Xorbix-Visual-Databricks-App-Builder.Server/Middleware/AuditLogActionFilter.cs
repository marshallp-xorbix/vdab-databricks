using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Middleware;

/// <summary>
/// Global action filter that automatically logs audit entries for actions
/// decorated with <see cref="AuditLogAttribute"/>.
/// </summary>
public class AuditLogActionFilter : IAsyncActionFilter
{
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AuditLogActionFilter> _logger;

    public AuditLogActionFilter(IAuditLogService auditLogService, ILogger<AuditLogActionFilter> logger)
    {
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        ActionExecutedContext executedContext = await next();

        AuditLogAttribute? attr = executedContext.ActionDescriptor
            .EndpointMetadata.OfType<AuditLogAttribute>().FirstOrDefault();
        if (attr is null) return;

        try
        {
            bool isSuccess = IsSuccessResult(executedContext);

            if (isSuccess && !attr.LogOnSuccess) return;
            if (!isSuccess && !attr.LogOnFailure) return;

            string severity = isSuccess ? "Info" : "Warning";
            if (executedContext.Exception is not null) severity = "Error";

            string actionType = isSuccess ? attr.ActionType : $"{attr.ActionType}Failed";

            string? ipAddress = context.HttpContext.Connection.RemoteIpAddress?.ToString();
            string userAgent = context.HttpContext.Request.Headers.UserAgent.ToString();

            Guid? userId = ExtractGuidClaim(context.HttpContext.User, ClaimTypes.NameIdentifier);
            Guid? tenantId = ExtractGuidClaim(context.HttpContext.User, TenantClaimTypes.TenantId);

            string? entityId = null;
            if (context.RouteData.Values.TryGetValue("id", out object? idVal) && idVal is not null)
            {
                entityId = idVal.ToString();
            }
            else if (context.RouteData.Values.TryGetValue("userId", out object? userIdVal) && userIdVal is not null)
            {
                entityId = userIdVal.ToString();
            }

            await _auditLogService.LogActionAsync(
                ipAddress ?? "unknown",
                userAgent,
                actionType,
                tenantId,
                userId,
                attr.EntityType,
                entityId,
                severity);
        }
        catch (Exception ex)
        {
            // CRITICAL: audit failures must NEVER break the main request flow
            _logger.LogError(ex, "Audit logging failed for {ActionType} on {EntityType}",
                attr.ActionType, attr.EntityType);
        }
    }

    /// <summary>
    /// Determines if the action result represents a successful HTTP response.
    /// </summary>
    private static bool IsSuccessResult(ActionExecutedContext context)
    {
        // Unhandled exception = failure
        if (context.Exception is not null && !context.ExceptionHandled)
            return false;

        return context.Result switch
        {
            ObjectResult obj => obj.StatusCode is null or (>= 200 and < 300),
            StatusCodeResult status => status.StatusCode is >= 200 and < 300,
            // ForbidResult, UnauthorizedResult, ChallengeResult — all failures
            _ => false
        };
    }

    private static Guid? ExtractGuidClaim(ClaimsPrincipal user, string claimType)
    {
        string? value = user.FindFirst(claimType)?.Value;
        return !string.IsNullOrEmpty(value) && Guid.TryParse(value, out Guid parsed) ? parsed : null;
    }
}