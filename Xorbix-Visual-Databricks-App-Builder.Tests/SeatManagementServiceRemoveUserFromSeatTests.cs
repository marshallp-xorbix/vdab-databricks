using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

/// <summary>
/// Tests for <see cref="SeatManagementService.RemoveUserFromSeatAsync"/> Phase 4:
/// seat FK/navigation cleared; account fields (including TenantId) never written; sessions always revoked.
/// </summary>
public class SeatManagementServiceRemoveUserFromSeatTests
{
    private const string ActiveSeatStatus = "Active";

    private readonly Mock<ISubscriptionSeatRepository> _seatRepository = new();
    private readonly Mock<ITenantRepository> _tenantRepository = new();
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();
    private readonly Mock<ISubscriptionTierService> _subscriptionTierService = new();
    private readonly Mock<ITenantAccessRevocationService> _tenantAccessRevocation = new();
    private readonly Mock<UserManager<ApplicationUser>> _userManager = new(
        Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    [Fact]
    public async Task RemoveUserFromSeatAsync_ClearsUserIdAndNavigationWhenUserIsLoaded()
    {
        Guid tenantId = Guid.NewGuid();
        Guid seatId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();

        ApplicationUser assignedUser = new()
        {
            Id = userId,
            Email = "dev@example.com",
            FirstName = "Dev",
            LastName = "User",
        };

        SubscriptionSeat seat = CreateOccupiedSeat(tenantId, seatId, userId, assignedUser, ActiveSeatStatus);

        SetupTeamTenant(tenantId);
        _seatRepository
            .Setup(repository => repository.GetByIdAsync(seatId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(seat);
        SetupMembershipRemoval(userId, tenantId);
        SetupSessionRevocation(userId);
        _userManager
            .Setup(manager => manager.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = userId, TenantId = Guid.NewGuid(), IsActive = true });

        SubscriptionSeat? capturedSeat = null;
        _seatRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<SubscriptionSeat>(), It.IsAny<CancellationToken>()))
            .Callback<SubscriptionSeat, CancellationToken>((updatedSeat, _) => capturedSeat = updatedSeat)
            .Returns(Task.CompletedTask);

        SeatManagementService service = CreateService();

        Result<SeatDto> result = await service.RemoveUserFromSeatAsync(tenantId, seatId, performedBy);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedSeat);
        Assert.Null(capturedSeat.UserId);
        Assert.Null(capturedSeat.AssignedAt);
        Assert.Null(capturedSeat.User);
        Assert.Equal(ActiveSeatStatus, capturedSeat.Status);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RemoveUserFromSeatAsync_DoesNotWriteTenantId_AndRevokesSessions()
    {
        Guid tenantId = Guid.NewGuid();
        Guid seatId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();

        ApplicationUser assignedUser = new()
        {
            Id = userId,
            Email = "owner@example.com",
            FirstName = "Owned",
            LastName = "User",
            TenantId = tenantId,
            IsActive = true,
        };

        SubscriptionSeat seat = CreateOccupiedSeat(tenantId, seatId, userId, assignedUser, ActiveSeatStatus);

        SetupTeamTenant(tenantId);
        _seatRepository
            .Setup(repository => repository.GetByIdAsync(seatId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(seat);
        SetupMembershipRemoval(userId, tenantId);
        SetupSessionRevocation(userId);
        _userManager
            .Setup(manager => manager.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(assignedUser);

        SubscriptionSeat? capturedSeat = null;
        _seatRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<SubscriptionSeat>(), It.IsAny<CancellationToken>()))
            .Callback<SubscriptionSeat, CancellationToken>((updatedSeat, _) => capturedSeat = updatedSeat)
            .Returns(Task.CompletedTask);

        SeatManagementService service = CreateService();

        Result<SeatDto> result = await service.RemoveUserFromSeatAsync(tenantId, seatId, performedBy);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedSeat);
        Assert.Null(capturedSeat.UserId);
        Assert.True(assignedUser.IsActive);
        Assert.Equal(tenantId, assignedUser.TenantId);
        Assert.Null(assignedUser.DeletedOn);
        Assert.Null(result.Value.UserId);
        _userManager.Verify(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private void SetupTeamTenant(Guid tenantId)
    {
        Tenant tenant = new()
        {
            TenantId = tenantId,
            TenantName = "team-tenant",
            DisplayName = "Team Tenant",
            SubscriptionTier = SubscriptionTierNames.Team,
            IsActive = true,
        };

        _tenantRepository
            .Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _subscriptionTierService
            .Setup(service => service.IsPerSeatTier(SubscriptionTierNames.Team))
            .Returns(true);
    }

    private void SetupMembershipRemoval(Guid userId, Guid tenantId)
    {
        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok("Developer"));
        _membershipService
            .Setup(service => service.RemoveUserFromTenantWithinTransactionAsync(userId, tenantId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
    }

    private void SetupSessionRevocation(Guid userId)
    {
        _tenantAccessRevocation
            .Setup(service => service.RevokeAsync(
                userId,
                It.IsAny<Guid>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    private static SubscriptionSeat CreateOccupiedSeat(
        Guid tenantId,
        Guid seatId,
        Guid userId,
        ApplicationUser assignedUser,
        string status)
    {
        return new SubscriptionSeat
        {
            SubscriptionSeatId = seatId,
            TenantId = tenantId,
            UserId = userId,
            User = assignedUser,
            Status = status,
            AssignedAt = DateTimeOffset.UtcNow,
            SeatStartDate = DateTimeOffset.UtcNow,
        };
    }

    private SeatManagementService CreateService()
    {
        Mock<IAuditLogService> audit = new();
        audit
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());

        return new SeatManagementService(
            NullLogger<SeatManagementService>.Instance,
            _seatRepository.Object,
            _tenantRepository.Object,
            _membershipService.Object,
            _subscriptionTierService.Object,
            Mock.Of<IInternalDevTenantService>(),
            Mock.Of<IStripeClient>(),
            _userManager.Object,
            _tenantAccessRevocation.Object,
            audit.Object);
    }
}
