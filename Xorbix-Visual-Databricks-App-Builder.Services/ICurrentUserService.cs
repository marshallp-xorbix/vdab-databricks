namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides access to the authenticated user's identity for the current request without
/// coupling the Services layer to <c>HttpContext</c> or <c>ClaimsPrincipal</c>. The web layer
/// supplies the implementation; business and infrastructure code depends only on this contract.
/// </summary>
public interface ICurrentUserService
{
    /// <summary>
    /// Gets the authenticated user's ID from the current request, or <c>null</c> when no user is
    /// authenticated or the claim is missing or malformed.
    /// </summary>
    Guid? GetUserId();

    /// <summary>
    /// Gets the authenticated user's current tenant ID, or <c>null</c> when no tenant context is
    /// present or the claim is missing or malformed.
    /// </summary>
    Guid? GetTenantId();

    /// <summary>
    /// Gets the authenticated user's email address, or <c>null</c> when no user is authenticated
    /// or the claim is missing.
    /// </summary>
    string? GetUserEmail();
}
