using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Represents an application user with extended properties.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    //TODO: Go through ApplicationUser Properties and handle
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool UsePasswordlessLogin { get; set; } = false;
    /// <summary>
    /// Gets or sets the user's Azure AD object identifier.
    /// </summary>
    public string? AzureAdObjectId { get; set; }

    /// <summary>
    /// The tenant that owns this user. Populated when the user was created as part of
    /// a tenant's sign-up or accepted a tenant invitation and had no prior owning tenant.
    /// A user can participate in multiple tenants via <see cref="TenantMemberships"/>,
    /// but only one tenant is the owner. Null for users not owned by any tenant
    /// (e.g., legacy global administrators).
    /// </summary>
    public Guid? TenantId { get; set; }

    /// <summary>
    /// Navigation property for the owning tenant. See <see cref="TenantId"/>.
    /// </summary>
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? OwningTenant { get; set; }

    /// <summary>
    /// Gets or sets whether the user wants to receive email notifications.
    /// </summary>
    public bool EmailNotificationsEnabled { get; set; } = true;

    /// <summary>
    /// Gets or sets whether the user wants to receive workflow update notifications.
    /// </summary>
    public bool WorkflowNotificationsEnabled { get; set; } = true;

    public DateTime? LastLoginAt { get; set; }

    /// <summary>
    /// Version date of the Terms of Service the user most recently accepted.
    /// Null when the user has never accepted a Terms of Service version.
    /// </summary>
    public DateOnly? TermsOfServiceVersionDate { get; set; }

    /// <summary>
    /// UTC timestamp when the user accepted the Terms of Service version
    /// captured in <see cref="TermsOfServiceVersionDate"/>.
    /// </summary>
    public DateTime? TermsOfServiceAcceptedOn { get; set; }

    /// <summary>
    /// Version date of the Privacy Policy the user most recently accepted.
    /// Null when the user has never accepted a Privacy Policy version.
    /// </summary>
    public DateOnly? PrivacyPolicyVersionDate { get; set; }

    /// <summary>
    /// UTC timestamp when the user accepted the Privacy Policy version
    /// captured in <see cref="PrivacyPolicyVersionDate"/>.
    /// </summary>
    public DateTime? PrivacyPolicyAcceptedOn { get; set; }

    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    public Guid? CreatedBy { get; set; }

    public DateTime? ModifiedOn { get; set; }

    public Guid? ModifiedBy { get; set; }

    public DateTime? DeletedOn { get; set; }

    public Guid? DeletedBy { get; set; }

    /// <summary>
    /// Why the account was retired. Set when <see cref="DeletedOn"/> is set; null on live accounts.
    /// </summary>
    public AccountRetirementReason? RetirementReason { get; set; }

    /// <summary>
    /// UTC timestamp when identifying fields were irreversibly anonymized.
    /// Null until anonymization runs (Phase 5 lazy anonymization).
    /// </summary>
    public DateTime? AnonymizedOn { get; set; }

    [NotMapped]
    public IList<string> Roles { get; set; } = [];

    /// <summary>
    /// Projected, client-safe tenant membership summaries populated by repository projections
    /// for list-style endpoints (e.g. /api/User). Not persisted; do not access from query
    /// translation. Empty when not populated by the caller.
    /// </summary>
    [NotMapped]
    public IList<UserTenantMembershipDto> TenantMembershipsSummary { get; set; } = [];

    /// <summary>
    /// Navigation property for the user's tenant memberships.
    /// A user can belong to multiple tenants with different roles.
    /// </summary>
    public virtual ICollection<UserTenantMembership> TenantMemberships { get; set; } = new List<UserTenantMembership>();

    public virtual ICollection<IdentityUserClaim<Guid>> Claims { get; set; } = null!;
    public virtual ICollection<IdentityUserLogin<Guid>> Logins { get; set; } = null!;
    public virtual ICollection<IdentityUserToken<Guid>> Tokens { get; set; } = null!;
    public virtual ICollection<IdentityUserRole<Guid>> UserRoles { get; set; } = null!;
}