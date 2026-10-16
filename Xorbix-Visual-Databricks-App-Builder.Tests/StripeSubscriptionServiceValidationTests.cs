using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class StripeSubscriptionServiceValidationTests
{
    [Fact]
    public async Task CreateSubscriptionAsync_FailsForEnterpriseTier()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenantId)).ReturnsAsync(tenant);

        StripeSubscriptionService service = CreateService(tenantRepository);

        Result<SubscriptionDto> result = await service.CreateSubscriptionAsync(tenantId, SubscriptionTierNames.Enterprise, "Monthly");

        Assert.True(result.IsFailed);
        Assert.IsType<ForbiddenError>(result.Errors[0]);
    }

    [Fact]
    public async Task GetSubscriptionAsync_FailsWhenTenantHasNoStripeSubscriptionId()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Individual);
        tenant.StripeSubscriptionId = null;

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenantId)).ReturnsAsync(tenant);

        StripeSubscriptionService service = CreateService(tenantRepository);

        Result<SubscriptionDto> result = await service.GetSubscriptionAsync(tenantId);

        Assert.True(result.IsFailed);
        Assert.IsType<NotFoundError>(result.Errors[0]);
    }

    [Fact]
    public async Task ExtendTrialAsync_FailsWhenTenantHasNoStripeSubscriptionId()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, SubscriptionTierNames.Team);
        tenant.StripeSubscriptionId = null;

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenantId)).ReturnsAsync(tenant);

        StripeSubscriptionService service = CreateService(tenantRepository);

        Result<SubscriptionDto> result = await service.ExtendTrialAsync(tenantId, DateTimeOffset.UtcNow.AddDays(7));

        Assert.True(result.IsFailed);
        Assert.IsType<NotFoundError>(result.Errors[0]);
    }

    private static StripeSubscriptionService CreateService(Mock<ITenantRepository> tenantRepository)
    {
        ISubscriptionTierService subscriptionTierService = new Mock<ISubscriptionTierService>().Object;
        ISeatManagementService seatManagementService = new Mock<ISeatManagementService>().Object;
        IStripeCustomerService stripeCustomerService = new Mock<IStripeCustomerService>().Object;
        ISubscriptionSeatRepository seatRepository = new Mock<ISubscriptionSeatRepository>().Object;
        IStripePromotionCodeService stripePromotionCodeService = new Mock<IStripePromotionCodeService>().Object;
        ISubscriptionHistoryRepository subscriptionHistoryRepository = new Mock<ISubscriptionHistoryRepository>().Object;
        IStripeClient stripeClient = Mock.Of<IStripeClient>();

        return new StripeSubscriptionService(
            NullLogger<StripeSubscriptionService>.Instance,
            tenantRepository.Object,
            subscriptionTierService,
            seatManagementService,
            stripeCustomerService,
            seatRepository,
            stripePromotionCodeService,
            subscriptionHistoryRepository,
            Mock.Of<IInternalDevTenantService>(),
            stripeClient);
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
