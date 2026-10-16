using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

/// <summary>
/// Tests for <see cref="SeatManagementService.RemoveMemberAsync"/> Phase 4 membership-only removal:
/// account fields (including TenantId) are never written; sessions are always revoked (no guest carve-out).
/// </summary>
public class SeatManagementServiceRemoveMemberTests
{
    private readonly Mock<ISubscriptionSeatRepository> _seatRepository = new();
    private readonly Mock<ITenantRepository> _tenantRepository = new();
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();
    private readonly Mock<ISubscriptionTierService> _subscriptionTierService = new();
    private readonly Mock<ITenantAccessRevocationService> _tenantAccessRevocation = new();
    private readonly Mock<IAuditLogService> _auditLogService = new();
    private readonly Mock<UserManager<ApplicationUser>> _userManager = new(
        Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    [Fact]
    public async Task RemoveMemberAsync_DoesNotWriteTenantId_AndAlwaysRevokesSessions()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();
        Guid originalTenantId = tenantId;

        ApplicationUser user = new() { Id = userId, TenantId = originalTenantId, IsActive = true };

        SetupTenant(tenantId);
        SetupNoSeat(tenantId, userId);
        SetupMembershipRemoval(userId, tenantId);
        SetupFindUser(user);
        SetupSessionRevocation(userId);
        SetupAuditOk();

        SeatManagementService service = CreateService();

        Result result = await service.RemoveMemberAsync(tenantId, userId, performedBy);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(user.IsActive);
        Assert.Equal(originalTenantId, user.TenantId);
        Assert.Null(user.DeletedOn);
        _userManager.Verify(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
        _auditLogService.Verify(
            s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                "MembershipEnd",
                tenantId,
                performedBy,
                It.IsAny<string?>(),
                userId.ToString(),
                It.IsAny<string>(),
                It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task RemoveMemberAsync_GuestUser_AlsoRevokesSessions_LeavesAccountUntouched()
    {
        Guid tenantId = Guid.NewGuid();
        Guid homeTenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();

        ApplicationUser user = new() { Id = userId, TenantId = homeTenantId, IsActive = true };

        SetupTenant(tenantId);
        SetupNoSeat(tenantId, userId);
        SetupMembershipRemoval(userId, tenantId);
        SetupFindUser(user);
        SetupSessionRevocation(userId);
        SetupAuditOk();

        SeatManagementService service = CreateService();

        Result result = await service.RemoveMemberAsync(tenantId, userId, performedBy);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(user.IsActive);
        Assert.Equal(homeTenantId, user.TenantId);
        Assert.Null(user.DeletedOn);
        _userManager.Verify(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
        // Security stamp rotation is owned by ITenantAccessRevocationService.
    }

    [Fact]
    public async Task RemoveMemberAsync_InactiveAccount_LeavesSoftDeleteUntouched_StillRevokes()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();
        DateTime existingDeletedOn = new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        Guid existingDeletedBy = Guid.NewGuid();

        ApplicationUser user = new()
        {
            Id = userId,
            TenantId = tenantId,
            IsActive = false,
            DeletedOn = existingDeletedOn,
            DeletedBy = existingDeletedBy,
        };

        SetupTenant(tenantId);
        SetupNoSeat(tenantId, userId);
        SetupMembershipRemoval(userId, tenantId);
        SetupFindUser(user);
        SetupSessionRevocation(userId);
        SetupAuditOk();

        SeatManagementService service = CreateService();

        Result result = await service.RemoveMemberAsync(tenantId, userId, performedBy);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.False(user.IsActive);
        Assert.Equal(existingDeletedOn, user.DeletedOn);
        Assert.Equal(existingDeletedBy, user.DeletedBy);
        Assert.Equal(tenantId, user.TenantId);
        _userManager.Verify(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RemoveMemberAsync_RemovingSelf_ReturnsForbidden()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();

        SetupTenant(tenantId);
        SetupNoSeat(tenantId, userId);

        SeatManagementService service = CreateService();

        Result result = await service.RemoveMemberAsync(tenantId, userId, performedByUserId: userId);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, error => error is ForbiddenError);
        _membershipService.Verify(
            service => service.RemoveUserFromTenantWithinTransactionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RemoveMemberAsync_TenantNotFound_ReturnsNotFound()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();

        _tenantRepository
            .Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);

        SeatManagementService service = CreateService();

        Result result = await service.RemoveMemberAsync(tenantId, userId, performedBy);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, error => error is NotFoundError);
        _membershipService.Verify(
            service => service.RemoveUserFromTenantWithinTransactionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RemoveMemberAsync_MembershipRemovalFails_ReturnsFailure()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();

        SetupTenant(tenantId);
        SetupNoSeat(tenantId, userId);
        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));
        _membershipService
            .Setup(service => service.RemoveUserFromTenantWithinTransactionAsync(userId, tenantId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail("not a member"));

        SeatManagementService service = CreateService();

        Result result = await service.RemoveMemberAsync(tenantId, userId, performedBy);

        Assert.True(result.IsFailed);
        _userManager.Verify(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RemoveMemberAsync_OccupiedActiveSeat_ClearsUserIdAndNavigation()
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

        SubscriptionSeat seat = new()
        {
            SubscriptionSeatId = seatId,
            TenantId = tenantId,
            UserId = userId,
            User = assignedUser,
            Status = "Active",
            AssignedAt = DateTimeOffset.UtcNow,
            SeatStartDate = DateTimeOffset.UtcNow,
        };

        SetupTeamTenant(tenantId);
        _seatRepository
            .Setup(repository => repository.GetByUserAsync(tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(seat);
        _seatRepository
            .Setup(repository => repository.GetByIdAsync(seatId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(seat);
        SetupMembershipRemoval(userId, tenantId);
        SetupSessionRevocation(userId);
        SetupAuditOk();
        _userManager
            .Setup(manager => manager.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = userId, TenantId = Guid.NewGuid(), IsActive = true });

        SubscriptionSeat? capturedSeat = null;
        _seatRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<SubscriptionSeat>(), It.IsAny<CancellationToken>()))
            .Callback<SubscriptionSeat, CancellationToken>((updatedSeat, _) => capturedSeat = updatedSeat)
            .Returns(Task.CompletedTask);

        SeatManagementService service = CreateService();

        Result result = await service.RemoveMemberAsync(tenantId, userId, performedBy);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedSeat);
        Assert.Null(capturedSeat.UserId);
        Assert.Null(capturedSeat.AssignedAt);
        Assert.Null(capturedSeat.User);
        Assert.Equal("Active", capturedSeat.Status);
        _membershipService.Verify(
            service => service.RemoveUserFromTenantWithinTransactionAsync(userId, tenantId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RemoveMemberAsync_OccupiedPendingCancellationSeat_ClearsAssignmentKeepsStatus()
    {
        Guid tenantId = Guid.NewGuid();
        Guid seatId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid performedBy = Guid.NewGuid();
        const string pendingStatus = "PendingCancellation";

        ApplicationUser assignedUser = new()
        {
            Id = userId,
            Email = "dev@example.com",
        };

        SubscriptionSeat seat = new()
        {
            SubscriptionSeatId = seatId,
            TenantId = tenantId,
            UserId = userId,
            User = assignedUser,
            Status = pendingStatus,
            AssignedAt = DateTimeOffset.UtcNow,
            SeatStartDate = DateTimeOffset.UtcNow,
            CanceledAt = DateTimeOffset.UtcNow,
        };

        SetupTeamTenant(tenantId);
        _seatRepository
            .Setup(repository => repository.GetByUserAsync(tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(seat);
        SetupMembershipRemoval(userId, tenantId);
        SetupSessionRevocation(userId);
        SetupAuditOk();
        _userManager
            .Setup(manager => manager.FindByIdAsync(userId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = userId, TenantId = Guid.NewGuid(), IsActive = true });

        SubscriptionSeat? capturedSeat = null;
        _seatRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<SubscriptionSeat>(), It.IsAny<CancellationToken>()))
            .Callback<SubscriptionSeat, CancellationToken>((updatedSeat, _) => capturedSeat = updatedSeat)
            .Returns(Task.CompletedTask);

        SeatManagementService service = CreateService();

        Result result = await service.RemoveMemberAsync(tenantId, userId, performedBy);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedSeat);
        Assert.Null(capturedSeat.UserId);
        Assert.Null(capturedSeat.AssignedAt);
        Assert.Null(capturedSeat.User);
        Assert.Equal(pendingStatus, capturedSeat.Status);
        _membershipService.Verify(
            service => service.RemoveUserFromTenantWithinTransactionAsync(userId, tenantId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _tenantAccessRevocation.Verify(
            service => service.RevokeAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private void SetupTenant(Guid tenantId, string subscriptionTier = SubscriptionTierNames.Team)
    {
        Tenant tenant = new()
        {
            TenantId = tenantId,
            TenantName = "tenant",
            DisplayName = "Tenant",
            SubscriptionTier = subscriptionTier,
            IsActive = true,
        };

        _tenantRepository
            .Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
    }

    private void SetupTeamTenant(Guid tenantId)
    {
        SetupTenant(tenantId, SubscriptionTierNames.Team);
        _subscriptionTierService
            .Setup(service => service.IsPerSeatTier(SubscriptionTierNames.Team))
            .Returns(true);
    }

    private void SetupNoSeat(Guid tenantId, Guid userId)
    {
        _seatRepository
            .Setup(repository => repository.GetByUserAsync(tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubscriptionSeat?)null);
    }

    private void SetupMembershipRemoval(Guid userId, Guid tenantId)
    {
        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));
        _membershipService
            .Setup(service => service.RemoveUserFromTenantWithinTransactionAsync(userId, tenantId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
    }

    private void SetupAuditOk()
    {
        _auditLogService
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

    private void SetupFindUser(ApplicationUser user)
    {
        _userManager
            .Setup(manager => manager.FindByIdAsync(user.Id.ToString()))
            .ReturnsAsync(user);
    }

    private SeatManagementService CreateService()
    {
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
            _auditLogService.Object);
    }
}
