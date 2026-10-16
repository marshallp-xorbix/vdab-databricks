using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Helpers for exercising authenticated controllers in isolation: builds a
/// <see cref="ControllerContext"/> whose <see cref="ClaimsPrincipal"/> carries the
/// user id, tenant id, and role claims that the controllers read for authorization.
/// </summary>
internal static class ControllerTestHelpers
{
    /// <summary>
    /// Builds a <see cref="ControllerContext"/> with the given caller identity.
    /// Tenant-scoped roles (<see cref="AuthRoles.TenantAdmin"/>, <see cref="AuthRoles.Developer"/>)
    /// are emitted as both <see cref="ClaimTypes.Role"/> and <c>tenant_role</c> claims.
    /// </summary>
    /// <param name="userId">The caller's user id (emitted as <see cref="ClaimTypes.NameIdentifier"/>).</param>
    /// <param name="tenantId">The caller's active tenant id, or null to omit the claim.</param>
    /// <param name="roles">The caller's role claims.</param>
    public static ControllerContext BuildContext(Guid userId, Guid? tenantId, params string[] roles)
    {
        List<Claim> claims =
        [
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, $"user-{userId}"),
        ];

        if (tenantId is Guid resolvedTenantId)
            claims.Add(new Claim(TenantClaimTypes.TenantId, resolvedTenantId.ToString()));

        foreach (string role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
            if (IsTenantScopedRole(role))
                claims.Add(new Claim(TenantClaimTypes.TenantRole, role));
        }

        return BuildControllerContext(claims);
    }

    /// <summary>
    /// Builds a <see cref="ControllerContext"/> with an explicit <c>tenant_role</c> claim
    /// separate from global <see cref="ClaimTypes.Role"/> claims.
    /// </summary>
    public static ControllerContext BuildContextWithTenantRole(
        Guid userId,
        Guid tenantId,
        string tenantRole,
        params string[] roles)
    {
        List<Claim> claims =
        [
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, $"user-{userId}"),
            new Claim(TenantClaimTypes.TenantId, tenantId.ToString()),
            new Claim(TenantClaimTypes.TenantRole, tenantRole),
        ];

        foreach (string role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        return BuildControllerContext(claims);
    }

    private static bool IsTenantScopedRole(string role) =>
        string.Equals(role, AuthRoles.TenantAdmin, StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, AuthRoles.Developer, StringComparison.OrdinalIgnoreCase);

    private static ControllerContext BuildControllerContext(List<Claim> claims)
    {
        ClaimsPrincipal principal = new(new ClaimsIdentity(claims, "TestAuth"));

        DefaultHttpContext httpContext = new() { User = principal };
        httpContext.Request.Method = "GET";
        httpContext.Request.Path = "/api/test";

        return new ControllerContext
        {
            HttpContext = httpContext,
            ActionDescriptor = new ControllerActionDescriptor(),
        };
    }

    /// <summary>
    /// Extracts the HTTP status code from an <see cref="ActionResult"/> produced by a controller,
    /// supporting both <see cref="ObjectResult"/> and <see cref="StatusCodeResult"/> shapes.
    /// </summary>
    public static int? StatusCodeOf(ActionResult? actionResult)
    {
        return actionResult switch
        {
            ObjectResult objectResult => objectResult.StatusCode,
            StatusCodeResult statusCodeResult => statusCodeResult.StatusCode,
            _ => null,
        };
    }
}
