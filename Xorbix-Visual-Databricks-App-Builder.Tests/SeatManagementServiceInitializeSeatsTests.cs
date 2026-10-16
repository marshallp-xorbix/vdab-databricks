using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class SeatManagementServiceInitializeSeatsTests
{
    [Fact]
    public async Task InitializeSeatsForSubscriptionAsync_CreatesTeamMinimumSeats_FromSeatOne()
    {
        Guid tenantId = Guid.NewGuid();
        Guid creatorUserId = Guid.NewGuid();

        List<SubscriptionSeat>? createdSeats = null;
        Mock<ISubscriptionSeatRepository> seatRepository = new();
        seatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<SubscriptionSeat>());
        seatRepository
            .Setup(repository => repository.AddRangeAsync(It.IsAny<IEnumerable<SubscriptionSeat>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<SubscriptionSeat>, CancellationToken>((seats, _) => createdSeats = seats.ToList())
            .Returns(Task.CompletedTask);

        Mock<IUserTenantMembershipService> membershipService = new();
        membershipService
            .Setup(service => service.UserBelongsToTenantAsync(creatorUserId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        Mock<ISubscriptionTierService> tierService = new();
        tierService
            .Setup(service => service.GetTierLimits(SubscriptionTierNames.Team))
            .Returns(Result.Ok(new SubscriptionTierLimits
            {
                MinimumSeats = 3,
                ScalesPerSeat = true,
                PublishedAppsPerSeat = 20,
                WorkspaceConnectionsPerSeat = 3
            }));
        tierService
            .Setup(service => service.IsPerSeatTier(SubscriptionTierNames.Team))
            .Returns(true);

        SeatManagementService service = new SeatManagementService(
            NullLogger<SeatManagementService>.Instance,
            seatRepository.Object,
            new Mock<ITenantRepository>().Object,
            membershipService.Object,
            tierService.Object,
            Mock.Of<IInternalDevTenantService>(),
            Mock.Of<IStripeClient>(),
            CreateUserManager(),
            Mock.Of<ITenantAccessRevocationService>(),
            Mock.Of<IAuditLogService>());

        Result<int> result = await service.InitializeSeatsForSubscriptionAsync(tenantId, SubscriptionTierNames.Team, creatorUserId);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value);
        Assert.NotNull(createdSeats);
        Assert.Equal(3, createdSeats!.Count);
        Assert.All(createdSeats, seat => Assert.True(seat.IsBundled));
        // Exactly one bundled seat is assigned to the creator; the rest start unoccupied.
        Assert.Equal(1, createdSeats.Count(seat => seat.UserId == creatorUserId));
        Assert.Equal(2, createdSeats.Count(seat => seat.UserId == null));
    }

    private static UserManager<ApplicationUser> CreateUserManager()
    {
        return new Mock<UserManager<ApplicationUser>>(
            Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!).Object;
    }
}
