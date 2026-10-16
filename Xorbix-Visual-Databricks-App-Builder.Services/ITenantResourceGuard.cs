using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Validates tenant-owned resources against the caller's JWT tenant context.
/// </summary>
public interface ITenantResourceGuard
{
    /// <summary>Ensures the app DTO belongs to the specified tenant.</summary>
    Result EnsureAppInTenant(AppDto? app, Guid tenantId);

    /// <summary>Ensures the app entity belongs to the specified tenant.</summary>
    Result EnsureAppInTenant(App? app, Guid tenantId);

    /// <summary>Ensures the Databricks connection belongs to the specified tenant.</summary>
    Result EnsureConnectionInTenant(DatabricksConnection? connection, Guid tenantId);

    /// <summary>Ensures the tenant AI model belongs to the specified tenant.</summary>
    Result EnsureTenantAiModelInTenant(TenantAiModel? model, Guid tenantId);

    /// <summary>
    /// Ensures the app belongs to the tenant and that the caller may delete it
    /// (the app owner, or a tenant administrator).
    /// </summary>
    Result EnsureCanDeleteApp(App? app, Guid tenantId, Guid userId, bool isTenantAdmin);

    /// <summary>
    /// Ensures the connection belongs to the tenant and that the caller may delete it
    /// (the connection owner, or a tenant administrator).
    /// </summary>
    Result EnsureCanDeleteConnection(DatabricksConnection? connection, Guid tenantId, Guid userId, bool isTenantAdmin);
}
