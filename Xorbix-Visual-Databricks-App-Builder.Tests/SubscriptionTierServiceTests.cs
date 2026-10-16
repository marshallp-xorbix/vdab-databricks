using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;
namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class SubscriptionTierServiceTests
{
    [Fact]
    public void GetPlans_ReturnsIndividualTeamEnterpriseInDisplayOrder()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<IReadOnlyList<PlanDto>> result = service.GetPlans();

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.Count);
        Assert.Equal(SubscriptionTierNames.Individual, result.Value[0].Tier);
        Assert.Equal(SubscriptionTierNames.Team, result.Value[1].Tier);
        Assert.Equal(SubscriptionTierNames.Enterprise, result.Value[2].Tier);
        Assert.Equal("individual", result.Value[0].Slug);
        Assert.Equal("team", result.Value[1].Slug);
        Assert.Equal("enterprise", result.Value[2].Slug);
    }

    [Fact]
    public void GetPlans_ProjectsIndividualFlatLimitsAndPricing()
    {
        SubscriptionTierService service = CreateService();

        PlanDto individual = service.GetPlans().Value.Single(p => p.Tier == SubscriptionTierNames.Individual);

        Assert.False(individual.PerSeat);
        Assert.True(individual.SelfServiceCheckout);
        Assert.Equal(1, individual.MinimumSeats);
        Assert.Equal(2000, individual.MonthlyPriceCents);
        Assert.Equal(22000, individual.YearlyPriceCents);
        Assert.Equal(10, individual.MaxPublishedApps);
        Assert.Equal(2, individual.MaxWorkspaceConnections);
        Assert.NotNull(individual.Trial);
        Assert.Equal(14, individual.Trial!.PeriodDays);
        Assert.Equal(1, individual.Trial.MaxPublishedApps);
        Assert.Equal(1, individual.Trial.MaxWorkspaceConnections);
    }

    [Fact]
    public void GetPlans_ProjectsTeamPerSeatLimitsAndMinimumSeats()
    {
        SubscriptionTierService service = CreateService();

        PlanDto team = service.GetPlans().Value.Single(p => p.Tier == SubscriptionTierNames.Team);

        Assert.True(team.PerSeat);
        Assert.True(team.SelfServiceCheckout);
        Assert.Equal(3, team.MinimumSeats);
        Assert.Equal(1500, team.MonthlyPriceCents);
        Assert.Equal(16000, team.YearlyPriceCents);
        Assert.Equal(20, team.MaxPublishedApps);
        Assert.Equal(3, team.MaxWorkspaceConnections);
        Assert.NotNull(team.Trial);
        Assert.Equal(3, team.Trial!.Seats);
    }

    [Fact]
    public void GetPlans_ProjectsEnterpriseAsUnlimitedSalesAssistedWithoutTrial()
    {
        SubscriptionTierService service = CreateService();

        PlanDto enterprise = service.GetPlans().Value.Single(p => p.Tier == SubscriptionTierNames.Enterprise);

        Assert.False(enterprise.PerSeat);
        Assert.False(enterprise.SelfServiceCheckout);
        Assert.Equal(0, enterprise.MonthlyPriceCents);
        Assert.Equal(2500000, enterprise.YearlyPriceCents);
        Assert.Equal(0, enterprise.MaxPublishedApps);
        Assert.Equal(0, enterprise.MaxWorkspaceConnections);
        Assert.Null(enterprise.Trial);
    }

    [Fact]
    public void GetTierLimits_ReturnsConfiguredTeamLimits()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<SubscriptionTierLimits> result = service.GetTierLimits(SubscriptionTierNames.Team);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.MinimumSeats);
        Assert.True(result.Value.ScalesPerSeat);
        Assert.Equal(20, result.Value.PublishedAppsPerSeat);
        Assert.Equal(3, result.Value.WorkspaceConnectionsPerSeat);
    }

    [Theory]
    [InlineData(1, 20, 3)]
    [InlineData(3, 60, 9)]
    [InlineData(5, 100, 15)]
    public void ResolveEffectiveLimits_ScalesTeamLimitsPerSeatWhenActive(int seatCount, int expectedApps, int expectedConnections)
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<EffectiveTierLimits> result = service.ResolveEffectiveLimits(SubscriptionTierNames.Team, SubscriptionStatusNames.Active, seatCount);

        Assert.True(result.IsSuccess);
        Assert.Equal(expectedApps, result.Value.MaxPublishedApps);
        Assert.Equal(expectedConnections, result.Value.MaxWorkspaceConnections);
    }

    [Fact]
    public void ResolveEffectiveLimits_TreatsZeroSeatsAsOneForScaling()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<EffectiveTierLimits> result = service.ResolveEffectiveLimits(SubscriptionTierNames.Team, SubscriptionStatusNames.Active, 0);

        Assert.True(result.IsSuccess);
        Assert.Equal(20, result.Value.MaxPublishedApps);
        Assert.Equal(3, result.Value.MaxWorkspaceConnections);
    }

    [Fact]
    public void ResolveEffectiveLimits_UsesTeamTrialFlatTotalsWhenTrialing()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<EffectiveTierLimits> result = service.ResolveEffectiveLimits(SubscriptionTierNames.Team, SubscriptionStatusNames.Trialing, 10);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.MaxPublishedApps);
        Assert.Equal(3, result.Value.MaxWorkspaceConnections);
    }

    [Fact]
    public void ResolveEffectiveLimits_UsesIndividualFlatLimitsWhenActive()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<EffectiveTierLimits> result = service.ResolveEffectiveLimits(SubscriptionTierNames.Individual, SubscriptionStatusNames.Active, 1);

        Assert.True(result.IsSuccess);
        Assert.Equal(10, result.Value.MaxPublishedApps);
        Assert.Equal(2, result.Value.MaxWorkspaceConnections);
    }

    [Fact]
    public void ResolveEffectiveLimits_UsesIndividualTrialLimitsWhenTrialing()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<EffectiveTierLimits> result = service.ResolveEffectiveLimits(SubscriptionTierNames.Individual, SubscriptionStatusNames.Trialing, 1);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.MaxPublishedApps);
        Assert.Equal(1, result.Value.MaxWorkspaceConnections);
    }

    [Fact]
    public void ResolveEffectiveLimits_KeepsTierLimitsWhenPaused()
    {
        // Paused tenants keep their persisted tier limits: a limit of 0 means unlimited in
        // this codebase, so lockout is enforced by the status gate in TenantLimitService
        // instead of zeroed limits.
        SubscriptionTierService service = CreateService();

        FluentResults.Result<EffectiveTierLimits> result = service.ResolveEffectiveLimits(SubscriptionTierNames.Individual, SubscriptionStatusNames.Paused, 1);

        Assert.True(result.IsSuccess);
        Assert.Equal(10, result.Value.MaxPublishedApps);
        Assert.Equal(2, result.Value.MaxWorkspaceConnections);
    }

    [Fact]
    public void ResolveEffectiveLimits_ReturnsUnlimitedForEnterprise()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<EffectiveTierLimits> result = service.ResolveEffectiveLimits(SubscriptionTierNames.Enterprise, SubscriptionStatusNames.Active, 100);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value.MaxPublishedApps);
        Assert.Equal(0, result.Value.MaxWorkspaceConnections);
    }

    [Fact]
    public void ResolveEffectiveLimits_FailsForInvalidTier()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<EffectiveTierLimits> result = service.ResolveEffectiveLimits("NotATier", SubscriptionStatusNames.Active, 1);

        Assert.True(result.IsFailed);
    }

    [Fact]
    public void GetTierPriceId_ReturnsConfiguredPriceIdForIndividual()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<string> result = service.GetTierPriceId(SubscriptionTierNames.Individual, BillingInterval.Monthly);

        Assert.True(result.IsSuccess);
        Assert.Equal("price_individual_monthly", result.Value);
    }

    [Fact]
    public void GetTierFromPriceId_ReturnsTierAndIntervalForMappedPriceId()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<(SubscriptionTier Tier, BillingInterval Interval)> result = service.GetTierFromPriceId("price_team_yearly");

        Assert.True(result.IsSuccess);
        Assert.Equal(SubscriptionTier.Team, result.Value.Tier);
        Assert.Equal(BillingInterval.Yearly, result.Value.Interval);
    }

    [Fact]
    public void IsPerSeatTier_ReturnsTrueOnlyForTeam()
    {
        SubscriptionTierService service = CreateService();

        bool teamResult = service.IsPerSeatTier(SubscriptionTierNames.Team);
        bool individualResult = service.IsPerSeatTier(SubscriptionTierNames.Individual);
        bool enterpriseResult = service.IsPerSeatTier(SubscriptionTierNames.Enterprise);

        Assert.True(teamResult);
        Assert.False(individualResult);
        Assert.False(enterpriseResult);
    }

    [Fact]
    public void GetTierPriceId_FailsForUnconfiguredPriceId()
    {
        SubscriptionTierService service = CreateService();

        FluentResults.Result<string> result = service.GetTierPriceId(SubscriptionTierNames.Enterprise, BillingInterval.Monthly);

        Assert.True(result.IsFailed);
    }

    private static SubscriptionTierService CreateService()
    {
        SubscriptionTierSettings tierSettings = new SubscriptionTierSettings
        {
            Individual = new SubscriptionTierLimits
            {
                MinimumSeats = 1,
                ScalesPerSeat = false,
                MaxPublishedApps = 10,
                MaxWorkspaceConnections = 2,
                SelfServiceCheckout = true,
                MonthlyPriceCents = 2000,
                YearlyPriceCents = 22000,
                Trial = new TrialLimits
                {
                    Enabled = true,
                    PeriodDays = 14,
                    Seats = 1,
                    MaxPublishedApps = 1,
                    MaxWorkspaceConnections = 1
                }
            },
            Team = new SubscriptionTierLimits
            {
                MinimumSeats = 3,
                ScalesPerSeat = true,
                PublishedAppsPerSeat = 20,
                WorkspaceConnectionsPerSeat = 3,
                SelfServiceCheckout = true,
                MonthlyPriceCents = 1500,
                YearlyPriceCents = 16000,
                Trial = new TrialLimits
                {
                    Enabled = true,
                    PeriodDays = 14,
                    Seats = 3,
                    MaxPublishedApps = 3,
                    MaxWorkspaceConnections = 3
                }
            },
            Enterprise = new SubscriptionTierLimits
            {
                MinimumSeats = 0,
                ScalesPerSeat = false,
                MaxPublishedApps = 0,
                MaxWorkspaceConnections = 0,
                SelfServiceCheckout = false,
                MonthlyPriceCents = 0,
                YearlyPriceCents = 2500000,
                Trial = new TrialLimits { Enabled = false }
            }
        };

        StripeSettings stripeSettings = new StripeSettings
        {
            SecretKey = "sk_test_123",
            WebhookSecret = "whsec_123",
            PublishableKey = "pk_test_123",
            PriceIds = new StripePriceIds
            {
                Individual = new TierPriceConfig
                {
                    Monthly = "price_individual_monthly",
                    Yearly = "price_individual_yearly"
                },
                Team = new TierPriceConfig
                {
                    Monthly = "price_team_monthly",
                    Yearly = "price_team_yearly"
                },
                Enterprise = new TierPriceConfig
                {
                    Monthly = "",
                    Yearly = ""
                }
            }
        };

        return new SubscriptionTierService(
            Options.Create(tierSettings),
            Options.Create(stripeSettings),
            NullLogger<SubscriptionTierService>.Instance);
    }
}