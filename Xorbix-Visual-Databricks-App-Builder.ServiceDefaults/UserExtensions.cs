using System.Security.Claims;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

/// <summary>
/// Extension methods for ClaimsPrincipal (User) to check elevated permissions.
/// </summary>
public static class UserExtensions
{
    /// <summary>
    /// Checks if the user has elevated permissions (Administrator or TenantAdmin roles).
    /// </summary>
    /// <param name="user">The ClaimsPrincipal representing the user.</param>
    /// <returns>True if the user has elevated permissions; otherwise, false.</returns>
    public static bool HasElevatedPermissions(this ClaimsPrincipal user)
    {
        return user.IsInRole(AuthRoles.Administrator) ||
               user.IsInRole(AuthRoles.TenantAdmin);
    }

    /// <summary>
    /// Gets the role hierarchy level for a given role.
    /// Administrator = 3, TenantAdmin = 2, Developer = 1, None = 0
    /// </summary>
    /// <param name="role">The role name.</param>
    /// <returns>The hierarchy level.</returns>
    public static int GetRoleHierarchyLevel(string role)
    {
        return role switch
        {
            AuthRoles.Administrator => 3,
            AuthRoles.TenantAdmin => 2,
            AuthRoles.Developer => 1,
            _ => 0
        };
    }

    /// <summary>
    /// Gets the highest role hierarchy level for a user based on their roles.
    /// </summary>
    /// <param name="user">The ClaimsPrincipal representing the user.</param>
    /// <returns>The highest hierarchy level.</returns>
    public static int GetHighestRoleLevel(this ClaimsPrincipal user)
    {
        if (user.IsInRole(AuthRoles.Administrator)) return 3;
        if (user.IsInRole(AuthRoles.TenantAdmin)) return 2;
        if (user.IsInRole(AuthRoles.Developer)) return 1;
        return 0;
    }

    /// <summary>
    /// Gets the highest role hierarchy level from a list of role names.
    /// </summary>
    /// <param name="roles">The list of role names.</param>
    /// <returns>The highest hierarchy level.</returns>
    public static int GetHighestRoleLevel(IEnumerable<string> roles)
    {
        return roles.Select(GetRoleHierarchyLevel).DefaultIfEmpty(0).Max();
    }

    /// <summary>
    /// Checks if the requesting user has sufficient permissions to modify the target user.
    /// The requesting user's role must be greater than or equal to the target user's highest role.
    /// </summary>
    /// <param name="requestingUser">The user making the request.</param>
    /// <param name="targetUserRoles">The roles of the target user.</param>
    /// <returns>True if the requesting user has sufficient permissions; otherwise, false.</returns>
    public static bool CanModifyUser(this ClaimsPrincipal requestingUser, IEnumerable<string> targetUserRoles)
    {
        int requestingUserLevel = requestingUser.GetHighestRoleLevel();
        int targetUserLevel = GetHighestRoleLevel(targetUserRoles);
        return requestingUserLevel >= targetUserLevel;
    }

    /// <summary>
    /// Checks if the requesting user has sufficient permissions to grant or revoke specific roles.
    /// The requesting user's role must be greater than or equal to the role being granted/revoked.
    /// </summary>
    /// <param name="requestingUser">The user making the request.</param>
    /// <param name="rolesToManage">The roles to be granted or revoked.</param>
    /// <returns>True if the requesting user has sufficient permissions; otherwise, false.</returns>
    public static bool CanManageRoles(this ClaimsPrincipal requestingUser, IEnumerable<string> rolesToManage)
    {
        int requestingUserLevel = requestingUser.GetHighestRoleLevel();
        int highestRoleToManage = GetHighestRoleLevel(rolesToManage);
        return requestingUserLevel >= highestRoleToManage;
    }
}
