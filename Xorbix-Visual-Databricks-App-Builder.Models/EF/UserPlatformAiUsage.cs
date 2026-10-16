using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Per-user monthly aggregate token usage for the VDAB Default AI Builder model.
/// Append-only counter; not soft-deleted.
/// </summary>
public class UserPlatformAiUsage
{
    /// <summary>
    /// Primary key for the usage counter row.
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

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
    /// Total tokens consumed in the period (input + output).
    /// </summary>
    public long TokensUsed { get; set; }

    /// <summary>
    /// When the counter row was created.
    /// </summary>
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the counter row was last incremented.
    /// </summary>
    public DateTime? ModifiedOn { get; set; }

    /// <summary>
    /// Navigation property for the user.
    /// </summary>
    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser? User { get; set; }
}
