using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents a tenant (organization) in the multi-tenant SaaS platform.
/// Each tenant has logical and physical data isolation.
/// </summary>
public class Tenant : TrackableEntity
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid TenantId { get; set; }

    /// <summary>
    /// Unique name/identifier for the tenant (e.g., company name or subdomain).
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string TenantName { get; set; }

    [Required]
    [MaxLength(200)]
    public required string DisplayName { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Current subscription tier (e.g., "Individual", "Team", "Enterprise").
    /// </summary>
    [MaxLength(50)]
    public string SubscriptionTier { get; set; } = string.Empty;

    /// <summary>
    /// Billing cycle: "Monthly" or "Annual".
    /// </summary>
    [MaxLength(20)]
    public string BillingCycle { get; set; } = string.Empty;

    /// <summary>
    /// Maximum number of users allowed for this tenant's subscription.
    /// </summary>
    public int MaxUsers { get; set; } = 0;

    /// <summary>
    /// Maximum number of published apps allowed.
    /// </summary>
    public int MaxPublishedApps { get; set; } = 0;

    /// <summary>
    /// Maximum number of workspace connections allowed.
    /// </summary>
    public int MaxWorkspaceConnections { get; set; } = 0;

    /// <summary>
    /// When the current subscription period started.
    /// </summary>
    public DateTimeOffset? SubscriptionStartDate { get; set; }

    /// <summary>
    /// When the current subscription period ends.
    /// </summary>
    public DateTimeOffset? SubscriptionEndDate { get; set; }

    /// <summary>
    /// When the current trial period ends, if the subscription is or was in a trial.
    /// Null when the tenant has never had a trial.
    /// </summary>
    public DateTimeOffset? TrialEndDate { get; set; }

    /// <summary>
    /// Whether the subscription is set to auto-renew.
    /// </summary>
    public bool AutoRenew { get; set; } = true;

    /// <summary>
    /// External billing provider customer ID (e.g., Stripe customer ID).
    /// </summary>
    [MaxLength(255)]
    public string? BillingCustomerId { get; set; }

    /// <summary>
    /// External billing provider subscription ID (e.g., Stripe subscription ID).
    /// </summary>
    [MaxLength(255)]
    public string? StripeSubscriptionId { get; set; }

    /// <summary>
    /// Current subscription status (none, active, past_due, canceled, trialing, incomplete).
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string SubscriptionStatus { get; set; } = "incomplete";

    /// <summary>
    /// Indicates whether the subscription is set to cancel at period end.
    /// </summary>
    public bool CancelAtPeriodEnd { get; set; } = false;

    /// <summary>
    /// The user who owns this tenant. Used for billing contact resolution.
    /// May differ from <see cref="TrackableEntity.CreatedBy"/> when an admin creates the tenant on behalf of a user.
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Name used on Stripe invoices. Defaults to <see cref="TenantName"/> at creation.
    /// </summary>
    [MaxLength(200)]
    public string? InvoiceName { get; set; }

    /// <summary>
    /// Email used on Stripe invoices. Defaults to the tenant owner's email at creation.
    /// </summary>
    [MaxLength(255)]
    public string? InvoiceEmail { get; set; }

    /// <summary>
    /// Navigation property: User memberships for this tenant.
    /// Contains users and their tenant-specific roles.
    /// </summary>
    public virtual ICollection<UserTenantMembership> UserMemberships { get; set; } = new List<UserTenantMembership>();

    /// <summary>
    /// Navigation property: Databricks connections for this tenant.
    /// </summary>
    public virtual ICollection<DatabricksConnection> DatabricksConnections { get; set; } = new List<DatabricksConnection>();

    /// <summary>
    /// Navigation property: Subscription history for this tenant.
    /// </summary>
    public virtual ICollection<SubscriptionHistory> SubscriptionHistory { get; set; } = new List<SubscriptionHistory>();

    /// <summary>
    /// Navigation property: Subscription seats owned by this tenant.
    /// </summary>
    public virtual ICollection<SubscriptionSeat> Seats { get; set; } = new List<SubscriptionSeat>();
}
