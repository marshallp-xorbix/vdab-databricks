using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
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

public class InternalDevTenantSeatTests
{
    [Fact]
    public void IsInternalDevTenant_ReturnsTrue_ForConfiguredTenantId()
    {
        Guid tenantId = Guid.NewGuid();
        InternalDevTenantService service = new InternalDevTenantService(
            Options.Create(new InternalDevTenantsConfiguration { TenantIds = [tenantId] }));

        Assert.True(service.IsInternalDevTenant(tenantId));
        Assert.False(service.IsInternalDevTenant(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetSeatSummaryAsync_SucceedsForAllowlistedEnterprise_WithHonestAvailableSeats()
    {
        Guid tenantId = Guid.NewGuid();
        Mock<ISubscriptionSeatRepository> seatRepository = new Mock<ISubscriptionSeatRepository>();
        seatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new SubscriptionSeat
                {
                    SubscriptionSeatId = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = Guid.NewGuid(),
                    Status = "Active",
                    IsBundled = true,
                    SeatStartDate = DateTimeOffset.UtcNow
                }
            ]);

        SeatManagementService service = CreateSeatService(
            tenantId,
            SubscriptionTierNames.Enterprise,
            isInternalDev: true,
            seatRepository.Object);

        Result<SeatSummaryDto> result = await service.GetSeatSummaryAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.OccupiedSeats);
        Assert.Equal(0, result.Value.AvailableSeats);
    }

    [Fact]
    public async Task GetSeatSummaryAsync_SucceedsForNonAllowlistedEnterprise_ReadOnly()
    {
        Guid tenantId = Guid.NewGuid();
        Mock<ISubscriptionSeatRepository> seatRepository = new Mock<ISubscriptionSeatRepository>();
        seatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new SubscriptionSeat
                {
                    SubscriptionSeatId = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = Guid.NewGuid(),
                    Status = "Active",
                    IsBundled = true,
                    SeatStartDate = DateTimeOffset.UtcNow
                }
            ]);

        SeatManagementService service = CreateSeatService(
            tenantId,
            SubscriptionTierNames.Enterprise,
            isInternalDev: false,
            seatRepository.Object);

        Result<SeatSummaryDto> result = await service.GetSeatSummaryAsync(tenantId);

        // Seat reads succeed for every tier; seat mutations remain Team/allowlist gated.
        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.OccupiedSeats);
        Assert.Equal(0, result.Value.AvailableSeats);
    }

    [Fact]
    public async Task IncreaseSeatQuantityForPurchaseAsync_SkipsStripe_ForAllowlistedTenant()
    {
        Guid tenantId = Guid.NewGuid();
        Mock<ISubscriptionSeatRepository> seatRepository = new Mock<ISubscriptionSeatRepository>();
        seatRepository
            .Setup(repository => repository.GetTotalActiveCountAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        Mock<IStripeClient> stripeClient = new Mock<IStripeClient>(MockBehavior.Strict);

        SeatManagementService service = CreateSeatService(
            tenantId,
            SubscriptionTierNames.Team,
            isInternalDev: true,
            seatRepository.Object,
            stripeClient.Object);

        Result result = await service.IncreaseSeatQuantityForPurchaseAsync(tenantId);

        Assert.True(result.IsSuccess);
        stripeClient.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task PreviewSeatChangeAsync_ReturnsZeroCostPreview_ForAllowlistedTenant()
    {
        Guid tenantId = Guid.NewGuid();
        Mock<ISubscriptionSeatRepository> seatRepository = new Mock<ISubscriptionSeatRepository>();
        seatRepository
            .Setup(repository => repository.GetTotalActiveCountAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(3);

        Mock<ISubscriptionTierService> subscriptionTierService = new Mock<ISubscriptionTierService>();
        subscriptionTierService
            .Setup(service => service.IsPerSeatTier(It.IsAny<string>()))
            .Returns(false);
        subscriptionTierService
            .Setup(service => service.GetTierLimits(It.IsAny<string>()))
            .Returns(Result.Ok(new SubscriptionTierLimits
            {
                MinimumSeats = 1,
                MaxPublishedApps = 0,
                MaxWorkspaceConnections = 0
            }));

        Mock<IStripeClient> stripeClient = new Mock<IStripeClient>(MockBehavior.Strict);

        SeatManagementService service = CreateSeatService(
            tenantId,
            SubscriptionTierNames.Enterprise,
            isInternalDev: true,
            seatRepository.Object,
            stripeClient.Object,
            subscriptionTierService.Object);

        Result<SeatPreviewDto> result = await service.PreviewSeatChangeAsync(tenantId, 1);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.CurrentSeats);
        Assert.Equal(4, result.Value.NewSeats);
        Assert.Equal(0m, result.Value.ProratedAmount);
        stripeClient.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ProcessPeriodEndCancellationsAsync_SkipsStripeAndKeepsUnlimitedLimits_ForAllowlistedTenant()
    {
        Guid tenantId = Guid.NewGuid();
        Guid pendingSeatId = Guid.NewGuid();
        SubscriptionSeat pendingSeat = new SubscriptionSeat
        {
            SubscriptionSeatId = pendingSeatId,
            TenantId = tenantId,
            UserId = Guid.NewGuid(),
            Status = "PendingCancellation",
            IsBundled = false,
            SeatStartDate = DateTimeOffset.UtcNow.AddDays(-30)
        };

        Mock<ISubscriptionSeatRepository> seatRepository = new Mock<ISubscriptionSeatRepository>();
        seatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([pendingSeat]);
        seatRepository
            .Setup(repository => repository.UpdateAsync(pendingSeat, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        seatRepository
            .Setup(repository => repository.GetTotalActiveCountAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Enterprise,
            MaxUsers = 0,
            MaxPublishedApps = 0,
            MaxWorkspaceConnections = 0,
            IsActive = true
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository
            .Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        tenantRepository
            .Setup(repository => repository.UpdateAsync(tenant, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Mock<IStripeClient> stripeClient = new Mock<IStripeClient>(MockBehavior.Strict);

        SeatManagementService service = CreateSeatService(
            tenantId,
            SubscriptionTierNames.Enterprise,
            isInternalDev: true,
            seatRepository.Object,
            stripeClient.Object,
            tenantRepository: tenantRepository.Object);

        Result<int> result = await service.ProcessPeriodEndCancellationsAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value);
        Assert.Equal(0, tenant.MaxUsers);
        Assert.Equal(0, tenant.MaxPublishedApps);
        Assert.Equal(0, tenant.MaxWorkspaceConnections);
        Assert.Equal("Canceled", pendingSeat.Status);
        stripeClient.VerifyNoOtherCalls();
        tenantRepository.Verify(
            repository => repository.UpdateAsync(tenant, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task GetEffectiveSubscriptionAsync_SetsAllowsComplimentarySeatManagement_ForAllowlistedTenant()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "xorbix",
            DisplayName = "Xorbix",
            SubscriptionTier = SubscriptionTierNames.Enterprise,
            SubscriptionStatus = "active",
            IsActive = true
        };

        Mock<ITenantService> tenantService = new Mock<ITenantService>();
        tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(tenant));

        Mock<IInternalDevTenantService> internalDevTenantService = new Mock<IInternalDevTenantService>();
        internalDevTenantService
            .Setup(service => service.IsInternalDevTenant(tenantId))
            .Returns(true);

        Xorbix_Visual_Databricks_App_Builder.Services.BillingService service = new Xorbix_Visual_Databricks_App_Builder.Services.BillingService(
            NullLogger<Xorbix_Visual_Databricks_App_Builder.Services.BillingService>.Instance,
            tenantService.Object,
            Mock.Of<IStripeCustomerService>(),
            Mock.Of<IStripeSubscriptionService>(),
            internalDevTenantService.Object,
            Mock.Of<IStripeClient>(),
            Options.Create(new StripeSettings()));

        Result<SubscriptionDto> result = await service.GetEffectiveSubscriptionAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.AllowsComplimentarySeatManagement);
        Assert.False(result.Value.HasStripeCustomer);
    }

    private static SeatManagementService CreateSeatService(
        Guid tenantId,
        string tier,
        bool isInternalDev,
        ISubscriptionSeatRepository? seatRepository = null,
        IStripeClient? stripeClient = null,
        ISubscriptionTierService? subscriptionTierService = null,
        ITenantRepository? tenantRepository = null)
    {
        Tenant tenant = tenantRepository is null
            ? new Tenant
            {
                TenantId = tenantId,
                TenantName = "tenant-name",
                DisplayName = "Tenant",
                SubscriptionTier = tier,
                IsActive = true
            }
            : null!;

        if (tenantRepository is null)
        {
            Mock<ITenantRepository> tenantRepositoryMock = new Mock<ITenantRepository>();
            tenantRepositoryMock
                .Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(tenant);
            tenantRepository = tenantRepositoryMock.Object;
        }

        if (subscriptionTierService is null)
        {
            Mock<ISubscriptionTierService> subscriptionTierServiceMock = new Mock<ISubscriptionTierService>();
            subscriptionTierServiceMock
                .Setup(service => service.IsPerSeatTier(It.IsAny<string>()))
                .Returns(string.Equals(tier, SubscriptionTierNames.Team, StringComparison.OrdinalIgnoreCase));
            subscriptionTierService = subscriptionTierServiceMock.Object;
        }

        Mock<IInternalDevTenantService> internalDevTenantService = new Mock<IInternalDevTenantService>();
        internalDevTenantService
            .Setup(service => service.IsInternalDevTenant(tenantId))
            .Returns(isInternalDev);

        UserManager<ApplicationUser> userManager = new Mock<UserManager<ApplicationUser>>(
            Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!).Object;

        return new SeatManagementService(
            NullLogger<SeatManagementService>.Instance,
            seatRepository ?? Mock.Of<ISubscriptionSeatRepository>(),
            tenantRepository,
            Mock.Of<IUserTenantMembershipService>(),
            subscriptionTierService,
            internalDevTenantService.Object,
            stripeClient ?? Mock.Of<IStripeClient>(),
            userManager,
            Mock.Of<ITenantAccessRevocationService>(),
            Mock.Of<IAuditLogService>());
    }
}
