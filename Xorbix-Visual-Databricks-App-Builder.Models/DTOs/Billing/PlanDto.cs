namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Public catalog entry describing a subscription plan: display pricing, limits, and trial terms.
/// Sourced from backend configuration and consumed by the marketing pricing page and checkout flow.
/// </summary>
public sealed class PlanDto
{
    /// <summary>Canonical tier name (for example: Individual, Team, Enterprise).</summary>
    public required string Tier { get; init; }

    /// <summary>Lowercase tier slug used by the client (for example: individual, team, enterprise).</summary>
    public required string Slug { get; init; }

    /// <summary>Human-readable plan name shown in the UI.</summary>
    public required string DisplayName { get; init; }

    /// <summary>Whether pricing and limits scale per seat (true for Team).</summary>
    public required bool PerSeat { get; init; }

    /// <summary>Minimum number of seats required to purchase the plan.</summary>
    public required int MinimumSeats { get; init; }

    /// <summary>
    /// Whether the plan can be purchased through self-service checkout. False for sales-assisted
    /// plans (Enterprise), which the UI presents with a "contact sales" action.
    /// </summary>
    public required bool SelfServiceCheckout { get; init; }

    /// <summary>
    /// Monthly display price in cents (per seat for per-seat plans). Zero when there is no
    /// self-service monthly price.
    /// </summary>
    public required int MonthlyPriceCents { get; init; }

    /// <summary>
    /// Yearly display price in cents (per seat for per-seat plans). Zero when there is no
    /// self-service yearly price.
    /// </summary>
    public required int YearlyPriceCents { get; init; }

    /// <summary>Published apps allowed (per seat for per-seat plans). Zero indicates unlimited.</summary>
    public required int MaxPublishedApps { get; init; }

    /// <summary>Workspace connections allowed (per seat for per-seat plans). Zero indicates unlimited.</summary>
    public required int MaxWorkspaceConnections { get; init; }

    /// <summary>Trial terms for the plan, or null when the plan offers no trial.</summary>
    public PlanTrialDto? Trial { get; init; }
}

/// <summary>
/// Trial terms for a subscription plan. Trial limits are flat totals (they do not scale per seat).
/// </summary>
public sealed class PlanTrialDto
{
    /// <summary>Trial length in days.</summary>
    public required int PeriodDays { get; init; }

    /// <summary>Number of seats included during the trial.</summary>
    public required int Seats { get; init; }

    /// <summary>Maximum published apps during the trial. Zero indicates unlimited.</summary>
    public required int MaxPublishedApps { get; init; }

    /// <summary>Maximum workspace connections during the trial. Zero indicates unlimited.</summary>
    public required int MaxWorkspaceConnections { get; init; }
}
