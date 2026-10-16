using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Administrator-facing operations that mutate a tenant's lifecycle: deactivation,
/// subscription cancellation, soft-delete with cascade, and full data purge.
/// </summary>
public interface ITenantLifecycleService
{
    /// <summary>
    /// Marks the tenant inactive (reversible), cancels the active Stripe subscription
    /// at period end on a best-effort basis, and revokes active sessions for users whose
    /// only tenant membership is this tenant.
    /// </summary>
    /// <param name="tenantId">Target tenant.</param>
    /// <param name="actingUserId">Acting administrator identifier (for audit).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Result> DeactivateTenantAsync(Guid tenantId, Guid actingUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Restores <c>IsActive</c> on a previously deactivated tenant. Does not resurrect a
    /// canceled Stripe subscription — billing must be set up again separately.
    /// </summary>
    Task<Result> ReactivateTenantAsync(Guid tenantId, Guid actingUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels the tenant's Stripe subscription only. When <paramref name="immediate"/> is
    /// false, cancellation occurs at period end. Tenant state is otherwise left untouched.
    /// </summary>
    Task<Result> CancelTenantSubscriptionAsync(Guid tenantId, bool immediate, Guid actingUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Soft-deletes the tenant and cascades soft-deletes to memberships, apps, Databricks
    /// connections, seats, and pending invites. Cancels Stripe immediately. Sole-tenant
    /// users are disabled and their sessions revoked; multi-tenant users only lose this
    /// membership.
    /// </summary>
    Task<Result> SoftDeleteTenantAsync(Guid tenantId, Guid actingUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Performs the soft-delete cascade and then permanently removes the tenant row and
    /// all owned child rows from the database. Sole-tenant users are disabled and their
    /// sessions revoked; their user records are retained (purging users is a separate
    /// operation handled by the user lifecycle service).
    /// </summary>
    Task<Result> PurgeTenantDataAsync(Guid tenantId, Guid actingUserId, CancellationToken cancellationToken = default);
}
