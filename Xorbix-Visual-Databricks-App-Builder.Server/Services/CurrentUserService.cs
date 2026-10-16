using System.Security.Claims;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Services;

/// <inheritdoc/>
public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    /// <inheritdoc/>
    public Guid? GetUserId()
    {
        string? value = httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(value, out Guid userId) ? userId : null;
    }

    /// <inheritdoc/>
    public Guid? GetTenantId()
    {
        string? value = httpContextAccessor.HttpContext?.User?.FindFirst(TenantClaimTypes.TenantId)?.Value;
        return Guid.TryParse(value, out Guid tenantId) ? tenantId : null;
    }

    /// <inheritdoc/>
    public string? GetUserEmail()
        => httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Email)?.Value;
}
