namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// DTO representing tenant details for entity-level endpoints.
/// </summary>
public class TenantDto
{
    /// <summary>
    /// The tenant's unique identifier.
    /// </summary>
    public required Guid TenantId { get; init; }

    /// <summary>
    /// The tenant's system name.
    /// </summary>
    public required string TenantName { get; init; }

    /// <summary>
    /// The tenant's display name.
    /// </summary>
    public required string DisplayName { get; init; }

    /// <summary>
    /// Whether the tenant is active.
    /// </summary>
    public required bool IsActive { get; init; }

    /// <summary>
    /// Current subscription tier (e.g., "Trial", "Individual", "Team", "Enterprise").
    /// </summary>
    public required string SubscriptionTier { get; init; }

    /// <summary>
    /// Billing cycle: "Monthly" or "Annual".
    /// </summary>
    public required string BillingCycle { get; init; }

    /// <summary>
    /// Maximum number of users allowed for this tenant's subscription.
    /// </summary>
    public required int MaxUsers { get; init; }

    /// <summary>
    /// Maximum number of published apps allowed.
    /// </summary>
    public required int MaxPublishedApps { get; init; }

    /// <summary>
    /// Maximum number of workspace connections allowed.
    /// </summary>
    public required int MaxWorkspaceConnections { get; init; }

    /// <summary>
    /// Current number of active user memberships for the tenant.
    /// </summary>
    public int UserCount { get; init; }

    /// <summary>
    /// Current number of active apps for the tenant.
    /// </summary>
    public int AppCount { get; init; }

    /// <summary>
    /// When the current subscription period started.
    /// </summary>
    public DateTimeOffset? SubscriptionStartDate { get; init; }

    /// <summary>
    /// When the current subscription period ends.
    /// </summary>
    public DateTimeOffset? SubscriptionEndDate { get; init; }

    /// <summary>
    /// When the current trial period ends, if the subscription is or was in a trial.
    /// </summary>
    public DateTimeOffset? TrialEndDate { get; init; }

    /// <summary>
    /// Whether the subscription is set to auto-renew.
    /// </summary>
    public required bool AutoRenew { get; init; }

    /// <summary>
    /// The tenant owner's user id.
    /// </summary>
    public Guid? OwnerId { get; init; }

    /// <summary>
    /// Name to use on billing invoices.
    /// </summary>
    public string? InvoiceName { get; init; }

    /// <summary>
    /// Email to use on billing invoices.
    /// </summary>
    public string? InvoiceEmail { get; init; }

    /// <summary>
    /// Current subscription lifecycle status.
    /// </summary>
    public required string SubscriptionStatus { get; init; }

    /// <summary>
    /// Stripe customer identifier associated with this tenant, if billing is linked.
    /// </summary>
    public string? BillingCustomerId { get; init; }

    /// <summary>
    /// Stripe subscription identifier for this tenant's active subscription, if any.
    /// </summary>
    public string? StripeSubscriptionId { get; init; }

    /// <summary>
    /// Whether the current Stripe subscription is set to cancel at the end of the period.
    /// </summary>
    public bool? CancelAtPeriodEnd { get; init; }

    /// <summary>
    /// When the tenant was created.
    /// </summary>
    public DateTimeOffset? CreatedOn { get; init; }
}
