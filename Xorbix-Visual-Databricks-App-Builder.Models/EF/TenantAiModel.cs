using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Tenant-scoped Databricks Model Serving configuration for AI Builder.
/// </summary>
public class TenantAiModel : TrackableEntity
{
    /// <summary>
    /// Primary key for the tenant AI model record.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int TenantAiModelId { get; set; }

    /// <summary>
    /// Foreign key referencing the owning tenant.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property for the tenant.
    /// </summary>
    [ForeignKey(nameof(TenantId))]
    public virtual Tenant? Tenant { get; set; }

    /// <summary>
    /// Foreign key referencing the linked Databricks workspace connection.
    /// </summary>
    public int DatabricksConnectionId { get; set; }

    /// <summary>
    /// Navigation property for the linked Databricks connection.
    /// </summary>
    [ForeignKey(nameof(DatabricksConnectionId))]
    public virtual DatabricksConnection? DatabricksConnection { get; set; }

    /// <summary>
    /// User-facing label shown in the AI Builder model selector.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public required string DisplayName { get; set; }

    /// <summary>
    /// Databricks Model Serving endpoint name (Semantic Kernel model id).
    /// </summary>
    [Required]
    [MaxLength(255)]
    public required string EndpointName { get; set; }

    /// <summary>
    /// Encrypted PAT used as the AI Gateway API key. Never exposed via API.
    /// </summary>
    [Required]
    [MaxLength(2000)]
    public required string AccessToken { get; set; }

    /// <summary>
    /// User who created this model configuration.
    /// </summary>
    public Guid CreatedByUserId { get; set; }
}
