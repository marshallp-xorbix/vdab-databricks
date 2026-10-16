using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class StripePromotionCodeServiceValidationTests
{
    [Fact]
    public async Task ValidateAsync_RejectsTrialTier()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateEligibleTenant(tenantId);

        StripePromotionCodeService service = CreateService(tenant);

        Result<PromoCodeValidationDto> result = await service.ValidateAsync(
            tenantId,
            "TEAM6FREE",
            SubscriptionTierNames.Trial,
            "Monthly");

        Assert.True(result.IsFailed);
        Assert.IsType<BadRequestError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_RejectsYearlyInterval()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateEligibleTenant(tenantId);

        StripePromotionCodeService service = CreateService(tenant);

        Result<PromoCodeValidationDto> result = await service.ValidateAsync(
            tenantId,
            "TEAM6FREE",
            SubscriptionTierNames.Team,
            "Yearly");

        Assert.True(result.IsFailed);
        Assert.IsType<BadRequestError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_RejectsWhenTenantHasActiveSubscription()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateEligibleTenant(tenantId);
        tenant.StripeSubscriptionId = "sub_existing";
        tenant.SubscriptionStatus = "active";

        StripePromotionCodeService service = CreateService(tenant);

        Result<PromoCodeValidationDto> result = await service.ValidateAsync(
            tenantId,
            "TEAM6FREE",
            SubscriptionTierNames.Team,
            "Monthly");

        Assert.True(result.IsFailed);
        Assert.IsType<ConflictError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_RejectsEnterpriseTier()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateEligibleTenant(tenantId);

        StripePromotionCodeService service = CreateService(tenant);

        Result<PromoCodeValidationDto> result = await service.ValidateAsync(
            tenantId,
            "TEAM6FREE",
            SubscriptionTierNames.Enterprise,
            "Monthly");

        Assert.True(result.IsFailed);
        Assert.IsType<BadRequestError>(result.Errors[0]);
    }

    private static StripePromotionCodeService CreateService(Tenant tenant)
    {
        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenant.TenantId)).ReturnsAsync(tenant);

        Mock<ISubscriptionTierService> subscriptionTierService = new Mock<ISubscriptionTierService>();
        subscriptionTierService
            .Setup(service => service.GetTierPriceId(SubscriptionTierNames.Team, BillingInterval.Monthly))
            .Returns(Result.Ok("price_team_monthly"));

        IStripeClient stripeClient = Mock.Of<IStripeClient>();

        return new StripePromotionCodeService(
            NullLogger<StripePromotionCodeService>.Instance,
            tenantRepository.Object,
            subscriptionTierService.Object,
            stripeClient);
    }

    private static Tenant CreateEligibleTenant(Guid tenantId)
    {
        return new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Team,
            SubscriptionStatus = "incomplete",
            IsActive = true
        };
    }
}
