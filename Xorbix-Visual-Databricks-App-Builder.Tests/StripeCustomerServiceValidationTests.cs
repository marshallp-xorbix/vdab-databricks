using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class StripeCustomerServiceValidationTests
{
    [Fact]
    public async Task CreateSetupIntentAsync_ReturnsValidationError_WhenCustomerIdIsMissing()
    {
        StripeCustomerService service = CreateService();

        Result<SetupIntentDto> result = await service.CreateSetupIntentAsync(string.Empty);

        Assert.True(result.IsFailed);
        Assert.IsType<ValidationError>(result.Errors[0]);
    }

    [Fact]
    public async Task ListPaymentMethodsAsync_ReturnsValidationError_WhenCustomerIdIsMissing()
    {
        StripeCustomerService service = CreateService();

        Result<IList<PaymentMethodDto>> result = await service.ListPaymentMethodsAsync("   ");

        Assert.True(result.IsFailed);
        Assert.IsType<ValidationError>(result.Errors[0]);
    }

    [Fact]
    public async Task SetDefaultPaymentMethodAsync_ReturnsValidationError_WhenCustomerIdIsMissing()
    {
        StripeCustomerService service = CreateService();

        Result result = await service.SetDefaultPaymentMethodAsync(string.Empty, "pm_123");

        Assert.True(result.IsFailed);
        Assert.IsType<ValidationError>(result.Errors[0]);
    }

    [Fact]
    public async Task SetDefaultPaymentMethodAsync_ReturnsValidationError_WhenPaymentMethodIdIsMissing()
    {
        StripeCustomerService service = CreateService();

        Result result = await service.SetDefaultPaymentMethodAsync("cus_123", "");

        Assert.True(result.IsFailed);
        Assert.IsType<ValidationError>(result.Errors[0]);
    }

    [Fact]
    public async Task DetachPaymentMethodAsync_ReturnsValidationError_WhenPaymentMethodIdIsMissing()
    {
        StripeCustomerService service = CreateService();

        Result result = await service.DetachPaymentMethodAsync(" ");

        Assert.True(result.IsFailed);
        Assert.IsType<ValidationError>(result.Errors[0]);
    }

    private static StripeCustomerService CreateService()
    {
        IStripeClient stripeClient = Mock.Of<IStripeClient>();
        ITenantRepository tenantRepository = new Mock<ITenantRepository>().Object;

        UserManager<ApplicationUser> userManager = new Mock<UserManager<ApplicationUser>>(
            Mock.Of<IUserStore<ApplicationUser>>(), null, null, null, null, null, null, null, null).Object;

        return new StripeCustomerService(
            NullLogger<StripeCustomerService>.Instance,
            stripeClient,
            tenantRepository,
            userManager);
    }
}
