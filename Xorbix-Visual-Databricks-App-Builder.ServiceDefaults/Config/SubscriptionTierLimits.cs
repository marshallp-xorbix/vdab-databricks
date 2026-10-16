using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configurable limits for a subscription tier.
/// </summary>
/// <remarks>
/// A value of <c>0</c> for any <c>Max*</c> limit indicates unlimited. When
/// <see cref="ScalesPerSeat"/> is <see langword="true"/>, the effective workspace and app
/// limits are computed as the corresponding <c>*PerSeat</c> value multiplied by the active
/// seat count; otherwise the flat <see cref="MaxWorkspaceConnections"/> and
/// <see cref="MaxPublishedApps"/> values are used.
/// </remarks>
[ExcludeFromCodeCoverage]
public sealed class SubscriptionTierLimits
{
    /// <summary>
    /// Minimum number of seats included in the tier.
    /// </summary>
    public int MinimumSeats { get; set; }

    /// <summary>
    /// When true, workspace and app limits scale with the active seat count using
    /// <see cref="WorkspaceConnectionsPerSeat"/> and <see cref="PublishedAppsPerSeat"/>.
    /// When false, the flat <see cref="MaxWorkspaceConnections"/> and
    /// <see cref="MaxPublishedApps"/> values apply.
    /// </summary>
    public bool ScalesPerSeat { get; set; }

    /// <summary>
    /// Maximum published apps allowed for the tier (flat). Zero indicates unlimited.
    /// Used only when <see cref="ScalesPerSeat"/> is false.
    /// </summary>
    public int MaxPublishedApps { get; set; }

    /// <summary>
    /// Maximum workspace connections allowed for the tier (flat). Zero indicates unlimited.
    /// Used only when <see cref="ScalesPerSeat"/> is false.
    /// </summary>
    public int MaxWorkspaceConnections { get; set; }

    /// <summary>
    /// Published apps granted per seat. Used only when <see cref="ScalesPerSeat"/> is true.
    /// Zero indicates unlimited.
    /// </summary>
    public int PublishedAppsPerSeat { get; set; }

    /// <summary>
    /// Workspace connections granted per seat. Used only when <see cref="ScalesPerSeat"/> is true.
    /// Zero indicates unlimited.
    /// </summary>
    public int WorkspaceConnectionsPerSeat { get; set; }

    /// <summary>
    /// Whether this tier can be purchased through self-service checkout. When false, the tier is
    /// sales-assisted only (for example, Enterprise) and the pricing UI surfaces a "contact sales"
    /// action instead of a checkout button.
    /// </summary>
    public bool SelfServiceCheckout { get; set; } = true;

    /// <summary>
    /// Display price in cents for monthly billing (for example, <c>2000</c> = $20.00). For per-seat
    /// tiers this is the price per seat. Zero indicates the tier has no self-service monthly price.
    /// </summary>
    public int MonthlyPriceCents { get; set; }

    /// <summary>
    /// Display price in cents for yearly billing (for example, <c>22000</c> = $220.00). For per-seat
    /// tiers this is the price per seat. Zero indicates the tier has no self-service yearly price.
    /// </summary>
    public int YearlyPriceCents { get; set; }

    /// <summary>
    /// Trial configuration for this tier. Null or disabled means the tier offers no trial.
    /// </summary>
    public TrialLimits? Trial { get; set; }
}

/// <summary>
/// Trial configuration and limits applied while a tier's subscription is in the trial period.
/// </summary>
/// <remarks>
/// Trial limits are flat totals (they do not scale per seat) and override the tier's
/// active-state limits while the subscription status is trialing.
/// </remarks>
[ExcludeFromCodeCoverage]
public sealed class TrialLimits
{
    /// <summary>
    /// Whether this tier offers a trial.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Trial length in days.
    /// </summary>
    public int PeriodDays { get; set; }

    /// <summary>
    /// Number of seats included during the trial.
    /// </summary>
    public int Seats { get; set; }

    /// <summary>
    /// Maximum published apps allowed during the trial (flat total). Zero indicates unlimited.
    /// </summary>
    public int MaxPublishedApps { get; set; }

    /// <summary>
    /// Maximum workspace connections allowed during the trial (flat total). Zero indicates unlimited.
    /// </summary>
    public int MaxWorkspaceConnections { get; set; }
}