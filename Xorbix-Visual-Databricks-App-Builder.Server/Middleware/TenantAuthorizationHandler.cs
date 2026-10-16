using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Middleware;

/// <summary>
/// Authorization handler that validates tenant-scoped role claims against the current tenant context.
/// Every caller must present a valid tenant_id claim and a tenant_role in the requirement's allowed set.
/// A global Administrator bypasses these checks only when the requirement permits it
/// (<see cref="TenantRoleRequirement.AllowGlobalAdministratorBypass"/>).
/// </summary>
public class TenantAuthorizationHandler : AuthorizationHandler<TenantRoleRequirement>
{
    private readonly ILogger<TenantAuthorizationHandler> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="TenantAuthorizationHandler"/> class.
    /// </summary>
    /// <param name="logger">Logger instance.</param>
    public TenantAuthorizationHandler(ILogger<TenantAuthorizationHandler> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc/>
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        TenantRoleRequirement requirement)
    {
        var user = context.User;

        if (user?.Identity?.IsAuthenticated != true)
        {
            _logger.LogDebug("User is not authenticated; tenant role requirement not satisfied.");
            return Task.CompletedTask;
        }

        // Global Administrator bypasses tenant checks only when the requirement allows it.
        if (requirement.AllowGlobalAdministratorBypass && user.IsInRole(AuthRoles.Administrator))
        {
            _logger.LogDebug("User has global Administrator role; requirement satisfied without tenant check.");
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        // For tenant-scoped roles, the JWT must contain a tenant_id claim
        var tenantIdClaim = user.FindFirst(TenantClaimTypes.TenantId);
        if (tenantIdClaim is null || string.IsNullOrEmpty(tenantIdClaim.Value))
        {
            _logger.LogWarning(
                "Tenant-scoped authorization failed: no tenant_id claim present for user {UserId}.",
                user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown");
            return Task.CompletedTask;
        }

        // Check if the user's tenant role (from JWT) matches any of the allowed roles
        var tenantRoleClaim = user.FindFirst(TenantClaimTypes.TenantRole);
        if (tenantRoleClaim is null || string.IsNullOrEmpty(tenantRoleClaim.Value))
        {
            _logger.LogWarning(
                "Tenant-scoped authorization failed: no tenant_role claim for user {UserId} in tenant {TenantId}.",
                user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown",
                tenantIdClaim.Value);
            return Task.CompletedTask;
        }

        // Check if the user's tenant role is in the list of allowed roles
        if (requirement.AllowedRoles.Contains(tenantRoleClaim.Value, StringComparer.OrdinalIgnoreCase))
        {
            _logger.LogDebug(
                "Tenant role '{TenantRole}' in tenant {TenantId} satisfies requirement.",
                tenantRoleClaim.Value,
                tenantIdClaim.Value);
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        _logger.LogWarning(
            "Tenant role '{TenantRole}' in tenant {TenantId} does not satisfy requirement. Allowed roles: [{AllowedRoles}].",
            tenantRoleClaim.Value,
            tenantIdClaim.Value,
            string.Join(", ", requirement.AllowedRoles));

        return Task.CompletedTask;
    }
}
