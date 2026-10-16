namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Revokes a user's access for a specific tenant after membership suspend or end.
/// </summary>
public interface ITenantAccessRevocationService
{
    /// <summary>
    /// Revokes refresh tokens minted under <paramref name="tenantId"/> and Databricks
    /// user tokens for that tenant's workspace connections. Does not rotate the account-wide
    /// security stamp (that would cascade logout across other tenants). Best-effort: each
    /// step is independent; failures are logged at Error and do not throw.
    /// </summary>
    /// <param name="userId">The user whose access is revoked.</param>
    /// <param name="tenantId">The tenant scope for refresh-token and Databricks revocation.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task RevokeAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default);
}
