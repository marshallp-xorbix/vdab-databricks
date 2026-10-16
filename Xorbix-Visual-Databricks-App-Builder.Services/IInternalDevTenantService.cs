namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Resolves whether a tenant is an internal/dev tenant with complimentary seat management.
/// </summary>
public interface IInternalDevTenantService
{
    /// <summary>
    /// Returns <c>true</c> when the tenant is configured as an internal/dev tenant
    /// that may manage seats and invite users without Stripe seat purchases.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <returns><c>true</c> when the tenant is on the internal/dev allowlist.</returns>
    bool IsInternalDevTenant(Guid tenantId);
}
