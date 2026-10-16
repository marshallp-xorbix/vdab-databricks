namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Preview information for a proposed seat count change.
/// </summary>
public class SeatPreviewDto
{
    /// <summary>
    /// Current billable seat count.
    /// </summary>
    public required int CurrentSeats { get; init; }

    /// <summary>
    /// Proposed billable seat count after the change.
    /// </summary>
    public required int NewSeats { get; init; }

    /// <summary>
    /// Prorated amount previewed for the seat change, in major currency units.
    /// </summary>
    public required decimal ProratedAmount { get; init; }

    /// <summary>
    /// ISO currency code for the previewed amount.
    /// </summary>
    public required string Currency { get; init; }

    /// <summary>
    /// Effective date used for the proration preview.
    /// </summary>
    public required DateTime EffectiveDate { get; init; }
}