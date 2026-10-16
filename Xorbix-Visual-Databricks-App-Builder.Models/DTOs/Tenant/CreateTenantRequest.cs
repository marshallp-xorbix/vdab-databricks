using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Request model for creating a new tenant (team creation flow).
/// </summary>
public class CreateTenantRequest
{
    /// <summary>
    /// Unique name/identifier for the tenant (e.g., company name or subdomain).
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string TenantName { get; init; }

    /// <summary>
    /// Display name for the tenant.
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string DisplayName { get; init; }

    /// <summary>
    /// Optional subscription tier to apply (e.g. "Trial", "Individual", "Team").
    /// When null, the tenant entity default is used.
    /// </summary>
    [MaxLength(50)]
    public string? SubscriptionTier { get; init; }

    /// <summary>
    /// Optional subscription status to apply (e.g. "incomplete").
    /// When null, the tenant entity default is used.
    /// </summary>
    [MaxLength(50)]
    public string? SubscriptionStatus { get; init; }

    /// <summary>
    /// The user who owns this tenant. Required for admin-created tenants;
    /// self-registration flows set this to the registering user's Id.
    /// </summary>
    public Guid? OwnerId { get; init; }

    [MaxLength(200)]
    public string? BillingName { get; init; } = string.Empty;
    public string? Email { get; init; } = string.Empty;
}
