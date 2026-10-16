using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class BillingServiceEffectiveSubscriptionTests
{
    [Fact]
    public async Task GetEffectiveSubscriptionAsync_SynthesizesPlan_WhenTenantHasActiveTierOverrideButNoStripeCustomer()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);
        tenant.SubscriptionStatus = "active";
        tenant.StripeSubscriptionId = null;
        tenant.BillingCustomerId = null;

        Mock<ITenantService> tenantService = new Mock<ITenantService>();
        tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(tenant));

        Mock<IStripeSubscriptionService> stripeSubscriptionService = new Mock<IStripeSubscriptionService>();

        Xorbix_Visual_Databricks_App_Builder.Services.BillingService service = CreateService(tenantService, stripeSubscriptionService);

        Result<SubscriptionDto> result = await service.GetEffectiveSubscriptionAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(SubscriptionTierNames.Team, result.Value.Tier);
        Assert.False(result.Value.HasStripeCustomer);
        stripeSubscriptionService.Verify(
            s => s.GetSubscriptionAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetEffectiveSubscriptionAsync_FailsWithNotFound_WhenSelfRegistrationIncompleteAndUnpaid()
    {
        // A self-registration that picked a tier but never completed payment is created
        // with status "incomplete" and no Stripe subscription. It must NOT be synthesized
        // into a usable plan.
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);
        tenant.SubscriptionStatus = "incomplete";
        tenant.StripeSubscriptionId = null;
        tenant.BillingCustomerId = null;

        Mock<ITenantService> tenantService = new Mock<ITenantService>();
        tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(tenant));

        Xorbix_Visual_Databricks_App_Builder.Services.BillingService service = CreateService(tenantService, new Mock<IStripeSubscriptionService>());

        Result<SubscriptionDto> result = await service.GetEffectiveSubscriptionAsync(tenantId);

        Assert.True(result.IsFailed);
        Assert.IsType<NotFoundError>(result.Errors[0]);
    }

    [Fact]
    public async Task GetEffectiveSubscriptionAsync_FailsWithNotFound_WhenTenantHasNoTierAndNoStripeSubscription()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);
        tenant.SubscriptionTier = string.Empty;
        tenant.SubscriptionStatus = "active";
        tenant.StripeSubscriptionId = null;
        tenant.BillingCustomerId = null;

        Mock<ITenantService> tenantService = new Mock<ITenantService>();
        tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(tenant));

        Xorbix_Visual_Databricks_App_Builder.Services.BillingService service = CreateService(tenantService, new Mock<IStripeSubscriptionService>());

        Result<SubscriptionDto> result = await service.GetEffectiveSubscriptionAsync(tenantId);

        Assert.True(result.IsFailed);
        Assert.IsType<NotFoundError>(result.Errors[0]);
    }

    [Fact]
    public async Task GetEffectiveSubscriptionAsync_DelegatesToStripe_WhenTenantHasStripeSubscription()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);
        tenant.StripeSubscriptionId = "sub_123";

        Mock<ITenantService> tenantService = new Mock<ITenantService>();
        tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(tenant));

        SubscriptionDto stripeSubscription = new SubscriptionDto
        {
            Id = "sub_123",
            Tier = SubscriptionTierNames.Team,
            Status = "active"
        };

        Mock<IStripeSubscriptionService> stripeSubscriptionService = new Mock<IStripeSubscriptionService>();
        stripeSubscriptionService
            .Setup(s => s.GetSubscriptionAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(stripeSubscription));

        Xorbix_Visual_Databricks_App_Builder.Services.BillingService service = CreateService(tenantService, stripeSubscriptionService);

        Result<SubscriptionDto> result = await service.GetEffectiveSubscriptionAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.Same(stripeSubscription, result.Value);
        Assert.True(result.Value.HasStripeCustomer);
    }

    private static Xorbix_Visual_Databricks_App_Builder.Services.BillingService CreateService(
        Mock<ITenantService> tenantService,
        Mock<IStripeSubscriptionService> stripeSubscriptionService)
    {
        IStripeCustomerService stripeCustomerService = new Mock<IStripeCustomerService>().Object;
        IStripeClient stripeClient = Mock.Of<IStripeClient>();
        IOptions<StripeSettings> stripeSettings = Options.Create(new StripeSettings());

        return new Xorbix_Visual_Databricks_App_Builder.Services.BillingService(
            NullLogger<Xorbix_Visual_Databricks_App_Builder.Services.BillingService>.Instance,
            tenantService.Object,
            stripeCustomerService,
            stripeSubscriptionService.Object,
            Mock.Of<IInternalDevTenantService>(),
            stripeClient,
            stripeSettings);
    }

    private static Tenant CreateTenant(Guid tenantId, string tier)
    {
        return new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = tier,
            IsActive = true
        };
    }
}
