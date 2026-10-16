using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging.Abstractions;
using Xorbix_Visual_Databricks_App_Builder.Server.Middleware;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Verifies <see cref="TenantAuthorizationHandler"/> enforces tenant membership and honors the
/// per-requirement global Administrator bypass flag.
/// </summary>
public class TenantAuthorizationHandlerTests
{
    private static readonly string[] DeveloperOrAdmin = [AuthRoles.Developer, AuthRoles.TenantAdmin];

    private static async Task<bool> EvaluateAsync(TenantRoleRequirement requirement, ClaimsPrincipal user)
    {
        TenantAuthorizationHandler handler = new(NullLogger<TenantAuthorizationHandler>.Instance);
        AuthorizationHandlerContext context = new([requirement], user, resource: null);
        await handler.HandleAsync(context);
        return context.HasSucceeded;
    }

    private static ClaimsPrincipal BuildUser(
        Guid? tenantId = null,
        string? tenantRole = null,
        string? globalRole = null)
    {
        List<Claim> claims = [new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())];

        if (tenantId is Guid resolvedTenantId)
            claims.Add(new Claim(TenantClaimTypes.TenantId, resolvedTenantId.ToString()));

        if (tenantRole is not null)
            claims.Add(new Claim(TenantClaimTypes.TenantRole, tenantRole));

        if (globalRole is not null)
            claims.Add(new Claim(ClaimTypes.Role, globalRole));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    [Fact]
    public async Task NoBypass_GlobalAdminWithoutTenant_Fails()
    {
        TenantRoleRequirement requirement = new(DeveloperOrAdmin) { AllowGlobalAdministratorBypass = false };
        ClaimsPrincipal user = BuildUser(globalRole: AuthRoles.Administrator);

        Assert.False(await EvaluateAsync(requirement, user));
    }

    [Fact]
    public async Task NoBypass_GlobalAdminWhoIsTenantMember_Succeeds()
    {
        TenantRoleRequirement requirement = new(DeveloperOrAdmin) { AllowGlobalAdministratorBypass = false };
        ClaimsPrincipal user = BuildUser(
            tenantId: Guid.NewGuid(),
            tenantRole: AuthRoles.Developer,
            globalRole: AuthRoles.Administrator);

        Assert.True(await EvaluateAsync(requirement, user));
    }

    [Fact]
    public async Task NoBypass_TenantDeveloper_Succeeds()
    {
        TenantRoleRequirement requirement = new(DeveloperOrAdmin) { AllowGlobalAdministratorBypass = false };
        ClaimsPrincipal user = BuildUser(tenantId: Guid.NewGuid(), tenantRole: AuthRoles.Developer);

        Assert.True(await EvaluateAsync(requirement, user));
    }

    [Fact]
    public async Task NoBypass_TenantMemberWithoutRoleClaim_Fails()
    {
        TenantRoleRequirement requirement = new(DeveloperOrAdmin) { AllowGlobalAdministratorBypass = false };
        ClaimsPrincipal user = BuildUser(tenantId: Guid.NewGuid());

        Assert.False(await EvaluateAsync(requirement, user));
    }

    [Fact]
    public async Task Bypass_GlobalAdminWithoutTenant_Succeeds()
    {
        TenantRoleRequirement requirement = new(AuthRoles.TenantAdmin, AuthRoles.Administrator);
        ClaimsPrincipal user = BuildUser(globalRole: AuthRoles.Administrator);

        Assert.True(await EvaluateAsync(requirement, user));
    }
}
