using Microsoft.AspNetCore.Authorization;
using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

/// <summary>
/// Authorization requirement that validates tenant-scoped roles.
/// The user must present a valid tenant_id claim and a tenant_role in <see cref="AllowedRoles"/>.
/// When <see cref="AllowGlobalAdministratorBypass"/> is <c>true</c>, a global Administrator
/// satisfies the requirement without any tenant check.
/// </summary>
[ExcludeFromCodeCoverage]
public class TenantRoleRequirement : IAuthorizationRequirement
{
    /// <summary>
    /// The roles that satisfy this requirement (checked hierarchically).
    /// </summary>
    public IReadOnlyList<string> AllowedRoles { get; }

    /// <summary>
    /// When <c>true</c> (default), a global Administrator satisfies the requirement without a
    /// tenant check. When <c>false</c>, even a global Administrator must present a valid
    /// tenant_id and an allowed tenant_role (i.e. they must be a member of the tenant).
    /// </summary>
    public bool AllowGlobalAdministratorBypass { get; init; } = true;

    /// <summary>
    /// Initializes a new instance of the <see cref="TenantRoleRequirement"/> class.
    /// </summary>
    /// <param name="allowedRoles">The roles that satisfy this requirement.</param>
    public TenantRoleRequirement(params string[] allowedRoles)
    {
        AllowedRoles = allowedRoles.ToList().AsReadOnly();
    }
}
