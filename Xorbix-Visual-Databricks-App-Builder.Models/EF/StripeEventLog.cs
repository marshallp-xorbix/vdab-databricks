using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Stores Stripe webhook/event processing records for idempotency and troubleshooting.
/// </summary>
public class StripeEventLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [MaxLength(255)]
    public required string StripeEventId { get; set; }

    [Required]
    [MaxLength(100)]
    public required string EventType { get; set; }

    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;

    [Column(TypeName = "text")]
    public string? Payload { get; set; }

    public bool Success { get; set; }

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    [MaxLength(255)]
    public string? CustomerId { get; set; }

    [MaxLength(500)]
    public string? DetailSummary { get; set; }
}
