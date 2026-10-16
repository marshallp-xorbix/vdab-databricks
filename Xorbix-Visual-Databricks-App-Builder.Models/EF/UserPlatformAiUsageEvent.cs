using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Per-LLM-call ledger entry for VDAB Default AI Builder token usage.
/// </summary>
public class UserPlatformAiUsageEvent
{
    /// <summary>
    /// Primary key for the ledger event.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    /// <summary>
    /// Foreign key referencing the user.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// UTC calendar month key in <c>yyyy-MM</c> format.
    /// </summary>
    [Required]
    [MaxLength(7)]
    public required string PeriodKey { get; set; }

    /// <summary>
    /// Total tokens reported by the LLM API for this call.
    /// </summary>
    public int TotalTokens { get; set; }

    /// <summary>
    /// Input tokens reported by the LLM API, when available.
    /// </summary>
    public int? InputTokens { get; set; }

    /// <summary>
    /// Output tokens reported by the LLM API, when available.
    /// </summary>
    public int? OutputTokens { get; set; }

    /// <summary>
    /// VDAB tenant context for the AI Builder session, when available.
    /// </summary>
    public Guid? TenantId { get; set; }

    /// <summary>
    /// VDAB app context for the AI Builder session, when available.
    /// </summary>
    public int? AppId { get; set; }

    /// <summary>
    /// When the usage event was recorded.
    /// </summary>
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Navigation property for the user.
    /// </summary>
    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser? User { get; set; }
}
