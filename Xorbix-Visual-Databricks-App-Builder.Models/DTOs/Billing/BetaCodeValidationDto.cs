namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Result of a successful beta code validation for display before starting the no-card trial.
/// </summary>
public class BetaCodeValidationDto
{
    /// <summary>
    /// Whether the beta code can be redeemed by the current tenant.
    /// </summary>
    public required bool IsValid { get; init; }

    /// <summary>
    /// Subscription tier granted by the code (Individual or Team).
    /// </summary>
    public required string Tier { get; init; }

    /// <summary>
    /// Trial length in days, when the code defines a relative trial period.
    /// </summary>
    public int? TrialPeriodDays { get; init; }

    /// <summary>
    /// Absolute UTC date when the trial will end.
    /// </summary>
    public DateTime? TrialEndDate { get; init; }

    /// <summary>
    /// Human-readable summary for the UI.
    /// </summary>
    public required string Message { get; init; }
}
