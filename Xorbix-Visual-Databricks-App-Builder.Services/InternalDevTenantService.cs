using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public sealed class InternalDevTenantService(
    IOptions<InternalDevTenantsConfiguration> options) : IInternalDevTenantService
{
    private readonly HashSet<Guid> _tenantIds = new(options.Value.TenantIds ?? []);

    /// <inheritdoc/>
    public bool IsInternalDevTenant(Guid tenantId)
    {
        return _tenantIds.Contains(tenantId);
    }
}
