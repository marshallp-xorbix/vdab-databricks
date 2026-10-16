using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class TenantServiceStripeCustomerIntegrationTests
{
    [Fact]
    public async Task CreateTenantAsync_FailsWhenStripeCustomerCreationFails()
    {
        Guid actorUserId = Guid.NewGuid();
        CreateTenantRequest request = new CreateTenantRequest
        {
            TenantName = "acme",
            DisplayName = "Acme"
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByNameAsync(request.TenantName)).ReturnsAsync((Tenant?)null);

        Mock<IUserTenantMembershipService> membershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        Mock<IStripeCustomerService> stripeCustomerService = new Mock<IStripeCustomerService>();
        stripeCustomerService
            .Setup(service => service.CreateStripeCustomerAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<string>("Stripe unavailable"));

        TenantService service = CreateService(
            tenantRepository,
            membershipService,
            tierService,
            stripeCustomerService);

        Result<TenantDto> result = await service.CreateTenantAsync(request, actorUserId);

        Assert.True(result.IsFailed);
        tenantRepository.Verify(repository => repository.CreateAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateTenantAsync_CreatesStripeCustomerBeforePersistingTenant()
    {
        Guid actorUserId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        CreateTenantRequest request = new CreateTenantRequest
        {
            TenantName = "beta",
            DisplayName = "Beta",
            SubscriptionStatus = "none"
        };

        Tenant? capturedTenantForCreate = null;

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByNameAsync(request.TenantName)).ReturnsAsync((Tenant?)null);
        tenantRepository
            .Setup(repository => repository.CreateAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .Callback<Tenant, CancellationToken>((tenant, ct) => capturedTenantForCreate = tenant)
            .ReturnsAsync((Tenant tenant, CancellationToken ct) =>
            {
                tenant.TenantId = tenantId;
                return tenant;
            });

        Mock<IUserTenantMembershipService> membershipService = new Mock<IUserTenantMembershipService>();
        membershipService
            .Setup(service => service.AddUserToTenantAsync(
                actorUserId,
                tenantId,
                It.IsAny<string>(),
                false,
                actorUserId))
            .ReturnsAsync(Result.Ok(new UserTenantMembership
            {
                UserId = actorUserId,
                TenantId = tenantId,
                Role = "Admin"
            }));

        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        Mock<IStripeCustomerService> stripeCustomerService = new Mock<IStripeCustomerService>();
        stripeCustomerService
            .Setup(service => service.CreateStripeCustomerAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .Callback<Tenant, CancellationToken>((tenant, ct) => tenant.BillingCustomerId = "cus_123")
            .ReturnsAsync(Result.Ok("cus_123"));

        TenantService service = CreateService(
            tenantRepository,
            membershipService,
            tierService,
            stripeCustomerService);

        Result<TenantDto> result = await service.CreateTenantAsync(request, actorUserId);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedTenantForCreate);
        Assert.Equal("cus_123", capturedTenantForCreate!.BillingCustomerId);

        stripeCustomerService.Verify(service => service.CreateStripeCustomerAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()), Times.Once);
        tenantRepository.Verify(repository => repository.CreateAsync(It.IsAny<Tenant>()), Times.Once);
    }

    [Fact]
    public async Task UpdateTenantAsync_FailsWhenStripeCustomerUpdateFails()
    {
        Guid tenantId = Guid.NewGuid();
        Guid actorUserId = Guid.NewGuid();

        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant",
            DisplayName = "Old Name",
            InvoiceName = "Old Invoice",
            BillingCustomerId = "cus_123"
        };

        UpdateTenantRequest request = new UpdateTenantRequest
        {
            DisplayName = "New Name",
            InvoiceName = "New Invoice"
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenantId)).ReturnsAsync(tenant);

        Mock<IUserTenantMembershipService> membershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        Mock<IStripeCustomerService> stripeCustomerService = new Mock<IStripeCustomerService>();
        stripeCustomerService
            .Setup(service => service.UpdateCustomerAsync(It.IsAny<Tenant>()))
            .ReturnsAsync(Result.Fail("Stripe update failed"));

        TenantService service = CreateService(
            tenantRepository,
            membershipService,
            tierService,
            stripeCustomerService);

        Result<Tenant> result = await service.UpdateTenantAsync(tenantId, request, actorUserId);

        Assert.True(result.IsFailed);
        tenantRepository.Verify(repository => repository.UpdateAsync(It.IsAny<Tenant>()), Times.Never);
    }

    [Fact]
    public async Task UpdateTenantAsync_UpdatesTenantWhenStripeCustomerUpdateSucceeds()
    {
        Guid tenantId = Guid.NewGuid();
        Guid actorUserId = Guid.NewGuid();

        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant",
            DisplayName = "Old Name",
            InvoiceEmail = "old@example.com",
            BillingCustomerId = "cus_123"
        };

        UpdateTenantRequest request = new UpdateTenantRequest
        {
            DisplayName = "New Name",
            InvoiceEmail = "new@example.com"
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenantId)).ReturnsAsync(tenant);
        tenantRepository.Setup(repository => repository.UpdateAsync(It.IsAny<Tenant>())).Returns(Task.CompletedTask);

        Mock<IUserTenantMembershipService> membershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        Mock<IStripeCustomerService> stripeCustomerService = new Mock<IStripeCustomerService>();
        stripeCustomerService
            .Setup(service => service.UpdateCustomerAsync(It.IsAny<Tenant>()))
            .ReturnsAsync(Result.Ok());

        TenantService service = CreateService(
            tenantRepository,
            membershipService,
            tierService,
            stripeCustomerService);

        Result<Tenant> result = await service.UpdateTenantAsync(tenantId, request, actorUserId);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Name", tenant.DisplayName);

        stripeCustomerService.Verify(service => service.UpdateCustomerAsync(It.Is<Tenant>(t => t.TenantId == tenantId)), Times.Once);
        tenantRepository.Verify(repository => repository.UpdateAsync(It.Is<Tenant>(t => t.TenantId == tenantId && t.DisplayName == "New Name")), Times.Once);
    }

    [Fact]
    public async Task UpdateTenantAsync_SkipsStripeSyncWhenInvoiceFieldsUnchanged()
    {
        Guid tenantId = Guid.NewGuid();
        Guid actorUserId = Guid.NewGuid();

        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant",
            DisplayName = "Old Name",
            InvoiceName = "Invoice",
            InvoiceEmail = "invoice@example.com",
            BillingCustomerId = "cus_123"
        };

        UpdateTenantRequest request = new UpdateTenantRequest
        {
            DisplayName = "New Name",
            InvoiceName = "Invoice",
            InvoiceEmail = "invoice@example.com"
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenantId)).ReturnsAsync(tenant);
        tenantRepository.Setup(repository => repository.UpdateAsync(It.IsAny<Tenant>())).Returns(Task.CompletedTask);

        Mock<IUserTenantMembershipService> membershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        Mock<IStripeCustomerService> stripeCustomerService = new Mock<IStripeCustomerService>();

        TenantService service = CreateService(
            tenantRepository,
            membershipService,
            tierService,
            stripeCustomerService);

        Result<Tenant> result = await service.UpdateTenantAsync(tenantId, request, actorUserId);

        Assert.True(result.IsSuccess);
        stripeCustomerService.Verify(
            service => service.UpdateCustomerAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()),
            Times.Never);
        tenantRepository.Verify(repository => repository.UpdateAsync(It.IsAny<Tenant>()), Times.Once);
    }

    [Fact]
    public async Task UpdateTenantAsync_SkipsStripeSyncWhenBillingCustomerIdMissing()
    {
        Guid tenantId = Guid.NewGuid();
        Guid actorUserId = Guid.NewGuid();

        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant",
            DisplayName = "Old Name",
            InvoiceName = "Old Invoice",
            BillingCustomerId = null
        };

        UpdateTenantRequest request = new UpdateTenantRequest
        {
            DisplayName = "New Name",
            InvoiceName = "New Invoice"
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByIdAsync(tenantId)).ReturnsAsync(tenant);
        tenantRepository.Setup(repository => repository.UpdateAsync(It.IsAny<Tenant>())).Returns(Task.CompletedTask);

        Mock<IUserTenantMembershipService> membershipService = new Mock<IUserTenantMembershipService>();
        Mock<ISubscriptionTierService> tierService = new Mock<ISubscriptionTierService>();
        Mock<IStripeCustomerService> stripeCustomerService = new Mock<IStripeCustomerService>();

        TenantService service = CreateService(
            tenantRepository,
            membershipService,
            tierService,
            stripeCustomerService);

        Result<Tenant> result = await service.UpdateTenantAsync(tenantId, request, actorUserId);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Invoice", tenant.InvoiceName);
        stripeCustomerService.Verify(
            service => service.UpdateCustomerAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private static TenantService CreateService(
        Mock<ITenantRepository> tenantRepository,
        Mock<IUserTenantMembershipService> membershipService,
        Mock<ISubscriptionTierService> tierService,
        Mock<IStripeCustomerService> stripeCustomerService)
    {
        return new TenantService(
            NullLogger<TenantService>.Instance,
            tenantRepository.Object,
            membershipService.Object,
            tierService.Object,
            stripeCustomerService.Object,
            new Mock<IAuditLogService>().Object);
    }
}
