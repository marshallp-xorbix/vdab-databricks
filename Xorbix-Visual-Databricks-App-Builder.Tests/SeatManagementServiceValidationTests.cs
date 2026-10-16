using FluentResults;
using Microsoft.AspNetCore.Identity;
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

public class SeatManagementServiceValidationTests
{
    private const string SeatManagementForbiddenMessage = "Seat management endpoints are only available for Team tier subscriptions.";

    [Fact]
    public async Task GetSeatsAsync_ReturnsStoredSeatsForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        SubscriptionSeat individualSeat = new()
        {
            SubscriptionSeatId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Status = "Active",
            IsBundled = true,
            SeatStartDate = DateTimeOffset.UtcNow,
        };

        Mock<ISubscriptionSeatRepository> seatRepository = new();
        seatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([individualSeat]);

        SeatManagementService service = CreateService(
            CreateTenantRepository(tenantId, SubscriptionTierNames.Individual),
            seatRepository.Object);

        Result<IList<SeatDto>> result = await service.GetSeatsAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value);
        Assert.Equal(userId, result.Value[0].UserId);
    }

    [Fact]
    public async Task GetSeatSummaryAsync_ReturnsStoredSummaryForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        SubscriptionSeat individualSeat = new()
        {
            SubscriptionSeatId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = Guid.NewGuid(),
            Status = "Active",
            IsBundled = true,
            SeatStartDate = DateTimeOffset.UtcNow,
        };

        Mock<ISubscriptionSeatRepository> seatRepository = new();
        seatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([individualSeat]);

        SeatManagementService service = CreateService(
            CreateTenantRepository(tenantId, SubscriptionTierNames.Individual),
            seatRepository.Object);

        Result<SeatSummaryDto> result = await service.GetSeatSummaryAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.TotalSeats);
        Assert.Equal(1, result.Value.OccupiedSeats);
        Assert.Equal(0, result.Value.AvailableSeats);
    }

    [Fact]
    public async Task GetSeatsAsync_ReturnsEmptyListWhenNonTeamTenantHasNoSeats()
    {
        Guid tenantId = Guid.NewGuid();
        SeatManagementService service = CreateService(CreateTenantRepository(tenantId, SubscriptionTierNames.Enterprise));

        Result<IList<SeatDto>> result = await service.GetSeatsAsync(tenantId);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task PurchaseAdditionalSeatsAsync_FailsForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        SeatManagementService service = CreateService(CreateTenantRepository(tenantId, SubscriptionTierNames.Individual));

        Result<IList<SeatDto>> result = await service.PurchaseAdditionalSeatsAsync(tenantId, 1);

        AssertSeatManagementForbidden(result);
    }

    [Fact]
    public async Task RemoveExtraSeatsAsync_FailsForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        SeatManagementService service = CreateService(CreateTenantRepository(tenantId, SubscriptionTierNames.Individual));

        Result<IList<SeatDto>> result = await service.RemoveExtraSeatsAsync(tenantId, 1);

        AssertSeatManagementForbidden(result);
    }

    [Fact]
    public async Task PreviewSeatChangeAsync_FailsForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        SeatManagementService service = CreateService(CreateTenantRepository(tenantId, SubscriptionTierNames.Individual));

        Result<SeatPreviewDto> result = await service.PreviewSeatChangeAsync(tenantId, 1);

        AssertSeatManagementForbidden(result);
    }

    [Fact]
    public async Task IncreaseSeatQuantityForPurchaseAsync_FailsForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        SeatManagementService service = CreateService(CreateTenantRepository(tenantId, SubscriptionTierNames.Individual));

        Result result = await service.IncreaseSeatQuantityForPurchaseAsync(tenantId);

        AssertSeatManagementForbidden(result);
    }

    [Fact]
    public async Task AssignSeatAsync_FailsForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        SeatManagementService service = CreateService(CreateTenantRepository(tenantId, SubscriptionTierNames.Individual));

        Result<SeatDto> result = await service.AssignSeatAsync(tenantId, Guid.NewGuid(), Guid.NewGuid());

        AssertSeatManagementForbidden(result);
    }

    [Fact]
    public async Task UnassignSeatAsync_FailsForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        SeatManagementService service = CreateService(CreateTenantRepository(tenantId, SubscriptionTierNames.Individual));

        Result<SeatDto> result = await service.UnassignSeatAsync(tenantId, Guid.NewGuid(), false);

        AssertSeatManagementForbidden(result);
    }

    [Fact]
    public async Task TransferSeatAsync_FailsForNonTeamTier()
    {
        Guid tenantId = Guid.NewGuid();
        SeatManagementService service = CreateService(CreateTenantRepository(tenantId, SubscriptionTierNames.Individual));

        Result<SeatDto> result = await service.TransferSeatAsync(tenantId, Guid.NewGuid(), Guid.NewGuid());

        AssertSeatManagementForbidden(result);
    }

    private static Mock<ITenantRepository> CreateTenantRepository(Guid tenantId, string tier)
    {
        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = tier,
            IsActive = true
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository
            .Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        return tenantRepository;
    }

    private static SeatManagementService CreateService(
        Mock<ITenantRepository> tenantRepository,
        ISubscriptionSeatRepository? subscriptionSeatRepository = null)
    {
        ISubscriptionSeatRepository seatRepository =
            subscriptionSeatRepository ?? new Mock<ISubscriptionSeatRepository>().Object;
        IUserTenantMembershipService userTenantMembershipService = new Mock<IUserTenantMembershipService>().Object;

        Mock<ISubscriptionTierService> subscriptionTierService = new Mock<ISubscriptionTierService>();
        subscriptionTierService
            .Setup(service => service.IsPerSeatTier(It.IsAny<string>()))
            .Returns(false);

        IStripeClient stripeClient = Mock.Of<IStripeClient>();

        UserManager<ApplicationUser> userManager = new Mock<UserManager<ApplicationUser>>(
            Mock.Of<IUserStore<ApplicationUser>>(), null, null, null, null, null, null, null, null).Object;

        return new SeatManagementService(
            NullLogger<SeatManagementService>.Instance,
            seatRepository,
            tenantRepository.Object,
            userTenantMembershipService,
            subscriptionTierService.Object,
            Mock.Of<IInternalDevTenantService>(),
            stripeClient,
            userManager,
            Mock.Of<ITenantAccessRevocationService>(),
            Mock.Of<IAuditLogService>());
    }

    private static void AssertSeatManagementForbidden(Result result)
    {
        Assert.True(result.IsFailed);
        Assert.IsType<ForbiddenError>(result.Errors[0]);
        Assert.Equal(SeatManagementForbiddenMessage, result.Errors[0].Message);
    }

    private static void AssertSeatManagementForbidden<T>(Result<T> result)
    {
        Assert.True(result.IsFailed);
        Assert.IsType<ForbiddenError>(result.Errors[0]);
        Assert.Equal(SeatManagementForbiddenMessage, result.Errors[0].Message);
    }
}