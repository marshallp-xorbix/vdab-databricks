using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Enforces a tenant's subscription feature limits (apps and workspace connections) at
/// creation time. A configured limit of <c>0</c> means unlimited and always passes.
/// </summary>
public interface ITenantLimitService
{
    /// <summary>
    /// Ensures the tenant has not reached its app limit. The limit counts every app under the
    /// tenant (no published/draft distinction).
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success when another app may be created; otherwise a failure.</returns>
    Task<Result> EnsureCanCreateAppAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ensures the tenant has not reached its workspace connection limit.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success when another workspace connection may be added; otherwise a failure.</returns>
    Task<Result> EnsureCanAddWorkspaceConnectionAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ensures the tenant's subscription is not in a locked status (for example, a paused
    /// no-card trial). Use this to gate edit, publish, run, and deploy actions in addition to
    /// the creation checks, which already enforce the same lock.
    /// </summary>
    /// <param name="tenantId">Tenant identifier.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success when the subscription is usable; otherwise a failure.</returns>
    Task<Result> EnsureSubscriptionActiveAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
