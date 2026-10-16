using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Request model for updating tenant settings.
/// </summary>
public class UpdateTenantRequest
{
    /// <summary>
    /// Updated display name for the tenant.
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string DisplayName { get; init; }

    /// <summary>
    /// Unique name/identifier for the tenant. When null, the existing value is preserved.
    /// </summary>
    [MaxLength(200)]
    public string? TenantName { get; init; }

    /// <summary>
    /// Name to use on Stripe invoices. When null, the existing value is preserved.
    /// </summary>
    [MaxLength(200)]
    public string? InvoiceName { get; init; }

    /// <summary>
    /// Email to use on Stripe invoices. When null, the existing value is preserved.
    /// </summary>
    [MaxLength(255)]
    [EmailAddress]
    public string? InvoiceEmail { get; init; }

    /// <summary>
    /// Optional owner reassignment. The supplied user must already be an active
    /// member of the tenant.
    /// </summary>
    public Guid? OwnerId { get; init; }

    /// <summary>
    /// Optional subscription tier override for administrative support scenarios.
    /// </summary>
    [MaxLength(50)]
    public string? SubscriptionTier { get; init; }

    /// <summary>
    /// Maximum number of users allowed for this tenant. When null, the existing value is preserved.
    /// </summary>
    [Range(0, int.MaxValue)]
    public int? MaxUsers { get; init; }

    /// <summary>
    /// Maximum number of published apps allowed for this tenant. When null, the existing value is preserved.
    /// </summary>
    [Range(0, int.MaxValue)]
    public int? MaxPublishedApps { get; init; }

    /// <summary>
    /// Maximum number of Databricks workspace connections allowed for this tenant.
    /// When null, the existing value is preserved.
    /// </summary>
    [Range(0, int.MaxValue)]
    public int? MaxWorkspaceConnections { get; init; }
}
