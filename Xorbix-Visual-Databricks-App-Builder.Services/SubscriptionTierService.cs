using FluentResults;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for resolving subscription tier limits and Stripe price mappings.
/// </summary>
public class SubscriptionTierService : ISubscriptionTierService
{
    private readonly ILogger<SubscriptionTierService> _logger;
    private readonly IReadOnlyDictionary<SubscriptionTier, SubscriptionTierLimits> _tierLimits;
    private readonly IReadOnlyDictionary<(SubscriptionTier, BillingInterval), string> _tierPriceIds;

    /// <summary>
    /// Initializes a new instance of the <see cref="SubscriptionTierService"/> class.
    /// </summary>
    /// <param name="tierSettingsOptions">Subscription tier settings options.</param>
    /// <param name="stripeSettingsOptions">Stripe settings options.</param>
    /// <param name="logger">Logger instance.</param>
    public SubscriptionTierService(
        IOptions<SubscriptionTierSettings> tierSettingsOptions,
        IOptions<StripeSettings> stripeSettingsOptions,
        ILogger<SubscriptionTierService> logger)
    {
        SubscriptionTierSettings tierSettings = tierSettingsOptions.Value;
        StripePriceIds priceIds = stripeSettingsOptions.Value.PriceIds;

        _tierLimits = new Dictionary<SubscriptionTier, SubscriptionTierLimits>
        {
            [SubscriptionTier.Individual] = tierSettings.Individual,
            [SubscriptionTier.Team] = tierSettings.Team,
            [SubscriptionTier.Enterprise] = tierSettings.Enterprise,
        };

        Dictionary<(SubscriptionTier, BillingInterval), string> tierPriceIds = new Dictionary<(SubscriptionTier, BillingInterval), string>
        {
            [(SubscriptionTier.Individual, BillingInterval.Monthly)] = priceIds.Individual.Monthly,
            [(SubscriptionTier.Individual, BillingInterval.Yearly)] = priceIds.Individual.Yearly,
            [(SubscriptionTier.Team, BillingInterval.Monthly)] = priceIds.Team.Monthly,
            [(SubscriptionTier.Team, BillingInterval.Yearly)] = priceIds.Team.Yearly,
            [(SubscriptionTier.Enterprise, BillingInterval.Monthly)] = priceIds.Enterprise.Monthly,
            [(SubscriptionTier.Enterprise, BillingInterval.Yearly)] = priceIds.Enterprise.Yearly,
        };

        _tierPriceIds = tierPriceIds;
        _logger = logger;
    }

    /// <inheritdoc/>
    public Result<IReadOnlyList<PlanDto>> GetPlans()
    {
        SubscriptionTier[] orderedTiers =
        [
            SubscriptionTier.Individual,
            SubscriptionTier.Team,
            SubscriptionTier.Enterprise,
        ];

        List<PlanDto> plans = new(orderedTiers.Length);
        foreach (SubscriptionTier tier in orderedTiers)
        {
            if (_tierLimits.TryGetValue(tier, out SubscriptionTierLimits? limits))
            {
                plans.Add(BuildPlan(tier, limits));
            }
        }

        return Result.Ok<IReadOnlyList<PlanDto>>(plans);
    }

    /// <summary>
    /// Projects a configured tier's limits into a public <see cref="PlanDto"/>. Per-seat tiers expose
    /// their per-seat limits; flat tiers expose their flat limits. A value of <c>0</c> stays <c>0</c>
    /// (unlimited).
    /// </summary>
    private static PlanDto BuildPlan(SubscriptionTier tier, SubscriptionTierLimits limits)
    {
        int maxPublishedApps = limits.ScalesPerSeat ? limits.PublishedAppsPerSeat : limits.MaxPublishedApps;
        int maxWorkspaceConnections = limits.ScalesPerSeat ? limits.WorkspaceConnectionsPerSeat : limits.MaxWorkspaceConnections;

        PlanTrialDto? trial = limits.Trial is { Enabled: true } trialLimits
            ? new PlanTrialDto
            {
                PeriodDays = trialLimits.PeriodDays,
                Seats = trialLimits.Seats,
                MaxPublishedApps = trialLimits.MaxPublishedApps,
                MaxWorkspaceConnections = trialLimits.MaxWorkspaceConnections,
            }
            : null;

        string tierName = tier.ToString();
        return new PlanDto
        {
            Tier = tierName,
            Slug = tierName.ToLowerInvariant(),
            DisplayName = tierName,
            PerSeat = limits.ScalesPerSeat,
            MinimumSeats = limits.MinimumSeats,
            SelfServiceCheckout = limits.SelfServiceCheckout,
            MonthlyPriceCents = limits.MonthlyPriceCents,
            YearlyPriceCents = limits.YearlyPriceCents,
            MaxPublishedApps = maxPublishedApps,
            MaxWorkspaceConnections = maxWorkspaceConnections,
            Trial = trial,
        };
    }

    /// <inheritdoc/>
    public Result<SubscriptionTierLimits> GetTierLimits(string tier)
    {
        if (!TryResolveTier(tier, out SubscriptionTier parsedTier))
        {
            return Result.Fail<SubscriptionTierLimits>($"Invalid subscription tier '{tier}'.");
        }

        if (!_tierLimits.TryGetValue(parsedTier, out SubscriptionTierLimits? limits))
        {
            _logger.LogWarning("Subscription tier limits are not configured for tier {Tier}", parsedTier);
            return Result.Fail<SubscriptionTierLimits>($"Tier limits are not configured for '{parsedTier}'.");
        }

        return Result.Ok(limits);
    }

    /// <inheritdoc/>
    public Result<EffectiveTierLimits> ResolveEffectiveLimits(string tier, string status, int seatCount)
    {
        Result<SubscriptionTierLimits> limitsResult = GetTierLimits(tier);
        if (limitsResult.IsFailed)
        {
            return Result.Fail<EffectiveTierLimits>(limitsResult.Errors);
        }

        SubscriptionTierLimits limits = limitsResult.Value;

        bool isTrialing = string.Equals(status, SubscriptionStatusNames.Trialing, StringComparison.OrdinalIgnoreCase);
        if (isTrialing && limits.Trial is { Enabled: true } trial)
        {
            return Result.Ok(new EffectiveTierLimits(trial.MaxPublishedApps, trial.MaxWorkspaceConnections));
        }

        // Locked statuses (for example, paused) keep their tier limits persisted unchanged;
        // resource creation is blocked by the status gate in TenantLimitService because a
        // persisted limit of 0 means unlimited and cannot represent "no access".

        if (limits.ScalesPerSeat)
        {
            int effectiveSeats = Math.Max(seatCount, 1);
            // A per-seat value of 0 means unlimited; multiplying preserves 0 (unlimited).
            int scaledApps = limits.PublishedAppsPerSeat * effectiveSeats;
            int scaledConnections = limits.WorkspaceConnectionsPerSeat * effectiveSeats;
            return Result.Ok(new EffectiveTierLimits(scaledApps, scaledConnections));
        }

        return Result.Ok(new EffectiveTierLimits(limits.MaxPublishedApps, limits.MaxWorkspaceConnections));
    }

    /// <inheritdoc/>
    public Result<string> GetTierPriceId(string tier, BillingInterval interval)
    {
        if (!TryResolveTier(tier, out SubscriptionTier parsedTier))
        {
            return Result.Fail<string>($"Invalid subscription tier '{tier}'.");
        }

        if (!_tierPriceIds.TryGetValue((parsedTier, interval), out string? priceId) || string.IsNullOrWhiteSpace(priceId))
        {
            return Result.Fail<string>($"Stripe price ID is not configured for tier '{parsedTier}' with interval '{interval}'.");
        }

        return Result.Ok(priceId);
    }

    /// <inheritdoc/>
    public Result<(SubscriptionTier Tier, BillingInterval Interval)> GetTierFromPriceId(string priceId)
    {
        if (string.IsNullOrWhiteSpace(priceId))
        {
            return Result.Fail<(SubscriptionTier, BillingInterval)>("Price ID is required.");
        }

        KeyValuePair<(SubscriptionTier, BillingInterval), string>? match = _tierPriceIds
            .Where(mapping => string.Equals(mapping.Value, priceId, StringComparison.Ordinal))
            .Select(mapping => (KeyValuePair<(SubscriptionTier, BillingInterval), string>?)mapping)
            .FirstOrDefault();

        if (match.HasValue)
        {
            return Result.Ok(match.Value.Key);
        }

        return Result.Fail<(SubscriptionTier, BillingInterval)>($"No subscription tier mapping exists for price ID '{priceId}'.");
    }

    /// <inheritdoc/>
    public bool IsPerSeatTier(string tier)
    {
        return TryResolveTier(tier, out SubscriptionTier parsedTier)
            && parsedTier == SubscriptionTier.Team;
    }

    /// <summary>
    /// Parses and normalizes a tier string.
    /// </summary>
    /// <param name="tier">Tier value from tenant or request context.</param>
    /// <param name="parsedTier">Resolved tier enum.</param>
    /// <returns>True when parsing succeeds.</returns>
    private static bool TryResolveTier(string tier, out SubscriptionTier parsedTier)
    {
        parsedTier = SubscriptionTier.None;

        if (string.IsNullOrWhiteSpace(tier))
        {
            return false;
        }

        if (Enum.TryParse(tier, ignoreCase: true, out parsedTier) && parsedTier != SubscriptionTier.None)
        {
            return true;
        }

        return false;
    }
}