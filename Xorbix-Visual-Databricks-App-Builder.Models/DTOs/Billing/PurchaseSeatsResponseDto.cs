namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Result payload for seat purchase requests.
/// </summary>
public class PurchaseSeatsResponseDto
{
    /// <summary>
    /// Newly created seat records.
    /// </summary>
    public required IList<SeatDto> Seats { get; init; }

    /// <summary>
    /// Proration preview captured for this purchase request.
    /// </summary>
    public required SeatPreviewDto ProrationPreview { get; init; }
}