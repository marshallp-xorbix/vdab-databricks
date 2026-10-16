using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

/// <summary>
/// Covers the over-allotment seat acquisition branches of invite acceptance:
/// assigning from an available seat, auto-purchasing a seat for a per-seat tenant,
/// flagging non per-seat tenants, and blocking + notifying admins when the purchase fails.
/// </summary>
public class TenantInviteServiceAcceptSeatTests
{
    private const string InviteEmail = "invitee@example.com";
    private const string NormalizedInviteEmail = "INVITEE@EXAMPLE.COM";

    [Fact]
    public async Task AcceptInviteAsync_NoSeatPerSeatTier_PurchaseSucceeds_AcceptsWithoutFlag()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid purchasedSeatId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(tenantId, userId, invite, SubscriptionTierNames.Team, isPerSeatTier: true);
        harness.SeatManagementService
            .Setup(service => service.IncreaseSeatQuantityForPurchaseAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        harness.SeatManagementService
            .Setup(service => service.MaterializePurchasedSeatAsync(tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(CreateSeatDto(purchasedSeatId, userId)));

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess);
        Assert.Equal(TenantInviteStatuses.Accepted, invite.Status);
        Assert.False(invite.RequiresSeatPurchase);
        Assert.Equal(purchasedSeatId, invite.ResultingSeatId);
        harness.SeatManagementService.Verify(
            service => service.IncreaseSeatQuantityForPurchaseAsync(tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
        harness.SeatManagementService.Verify(
            service => service.MaterializePurchasedSeatAsync(tenantId, userId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task AcceptInviteAsync_NoSeatPerSeatTier_PurchaseFails_BlocksAndNotifiesAdmins()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(tenantId, userId, invite, SubscriptionTierNames.Team, isPerSeatTier: true);
        harness.SeatManagementService
            .Setup(service => service.IncreaseSeatQuantityForPurchaseAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new BadRequestError("Unable to load Stripe subscription details.")));

        harness.WithTenantAdminRecipient("admin@example.com");

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsFailed);
        Assert.NotEqual(TenantInviteStatuses.Accepted, invite.Status);
        harness.TenantInviteRepository.Verify(
            repository => repository.UpdateAsync(It.IsAny<TenantInvite>(), It.IsAny<CancellationToken>()),
            Times.Never);
        harness.SeatManagementService.Verify(
            service => service.MaterializePurchasedSeatAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        Assert.True(
            harness.AdminNotificationSent.Wait(TimeSpan.FromSeconds(5)),
            "Admin seat-purchase-failure notification was not sent.");
    }

    [Fact]
    public async Task AcceptInviteAsync_NoSeatNonPerSeatTier_AcceptsWithRequiresSeatPurchaseFlag()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(tenantId, userId, invite, SubscriptionTierNames.Individual, isPerSeatTier: false);

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess);
        Assert.Equal(TenantInviteStatuses.Accepted, invite.Status);
        Assert.True(invite.RequiresSeatPurchase);
        Assert.Null(invite.ResultingSeatId);
        harness.SeatManagementService.Verify(
            service => service.IncreaseSeatQuantityForPurchaseAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task AcceptInviteAsync_NoSeatInternalDevEnterprise_PurchasesComplimentarySeat()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid purchasedSeatId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(
            tenantId,
            userId,
            invite,
            SubscriptionTierNames.Enterprise,
            isPerSeatTier: false,
            isInternalDevTenant: true);
        harness.SeatManagementService
            .Setup(service => service.IncreaseSeatQuantityForPurchaseAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        harness.SeatManagementService
            .Setup(service => service.MaterializePurchasedSeatAsync(tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(CreateSeatDto(purchasedSeatId, userId)));

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess);
        Assert.Equal(TenantInviteStatuses.Accepted, invite.Status);
        Assert.False(invite.RequiresSeatPurchase);
        Assert.Equal(purchasedSeatId, invite.ResultingSeatId);
        harness.SeatManagementService.Verify(
            service => service.IncreaseSeatQuantityForPurchaseAsync(tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
        harness.SeatManagementService.Verify(
            service => service.MaterializePurchasedSeatAsync(tenantId, userId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task AcceptInviteAsync_NoSeatNonAllowlistedEnterprise_AcceptsWithRequiresSeatPurchaseFlag()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(
            tenantId,
            userId,
            invite,
            SubscriptionTierNames.Enterprise,
            isPerSeatTier: false,
            isInternalDevTenant: false);

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess);
        Assert.Equal(TenantInviteStatuses.Accepted, invite.Status);
        Assert.True(invite.RequiresSeatPurchase);
        Assert.Null(invite.ResultingSeatId);
        harness.SeatManagementService.Verify(
            service => service.IncreaseSeatQuantityForPurchaseAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task AcceptInviteAsync_AvailableSeat_AssignsWithoutPurchase()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid seatId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(tenantId, userId, invite, SubscriptionTierNames.Team, isPerSeatTier: true);
        harness.WithAvailableSeat(seatId);
        harness.SeatManagementService
            .Setup(service => service.AssignSeatAsync(tenantId, seatId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(CreateSeatDto(seatId, userId)));

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess);
        Assert.Equal(TenantInviteStatuses.Accepted, invite.Status);
        Assert.False(invite.RequiresSeatPurchase);
        Assert.Equal(seatId, invite.ResultingSeatId);
        harness.SeatManagementService.Verify(
            service => service.IncreaseSeatQuantityForPurchaseAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task AcceptInviteAsync_PurchasePath_IncreasesStripeQuantityBeforeMaterializingSeat()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid purchasedSeatId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(tenantId, userId, invite, SubscriptionTierNames.Team, isPerSeatTier: true);

        List<string> callOrder = new();
        harness.SeatManagementService
            .Setup(service => service.IncreaseSeatQuantityForPurchaseAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok())
            .Callback(() => callOrder.Add("bump"));
        harness.SeatManagementService
            .Setup(service => service.MaterializePurchasedSeatAsync(tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(CreateSeatDto(purchasedSeatId, userId)))
            .Callback(() => callOrder.Add("materialize"));

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess);
        // The Stripe seat-quantity increase must happen before the local seat is recorded, so a
        // billing decline aborts with nothing written and no transaction held across the call.
        Assert.Equal(new[] { "bump", "materialize" }, callOrder);
    }

    [Fact]
    public async Task AcceptInviteAsync_UserAlreadySeated_AcceptsWithoutPurchaseOrAssign()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid existingSeatId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(tenantId, userId, invite, SubscriptionTierNames.Team, isPerSeatTier: true);
        harness.WithExistingUserSeat(userId, existingSeatId);

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess);
        Assert.Equal(TenantInviteStatuses.Accepted, invite.Status);
        Assert.False(invite.RequiresSeatPurchase);
        Assert.Equal(existingSeatId, invite.ResultingSeatId);
        harness.SeatManagementService.Verify(
            service => service.IncreaseSeatQuantityForPurchaseAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        harness.SeatManagementService.Verify(
            service => service.MaterializePurchasedSeatAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        harness.SeatManagementService.Verify(
            service => service.AssignSeatAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task AcceptInviteAsync_NoLiveMembership_UsesWithinTransactionAddAndAccepts()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid availableSeatId = Guid.NewGuid();
        TenantInvite invite = CreatePendingInvite(tenantId);

        TestHarness harness = new TestHarness(tenantId, userId, invite, SubscriptionTierNames.Team, isPerSeatTier: true);
        harness.WithNoLiveMembership(userId);
        harness.WithAvailableSeat(availableSeatId);
        harness.SeatManagementService
            .Setup(service => service.AssignSeatAsync(tenantId, availableSeatId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(CreateSeatDto(availableSeatId, userId)));

        UserTenantMembership reactivated = new UserTenantMembership
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            Status = MembershipStatus.Active,
            IsDefault = true,
        };
        harness.UserTenantMembershipService
            .Setup(service => service.AddUserToTenantWithinTransactionAsync(
                userId,
                tenantId,
                AuthRoles.Developer,
                false,
                invite.InvitedByUserId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(reactivated));

        Result result = await harness.Service.AcceptInviteAsync("raw-token", userId);

        Assert.True(result.IsSuccess, string.Join("; ", result.Errors.Select(error => error.Message)));
        Assert.Equal(TenantInviteStatuses.Accepted, invite.Status);
        Assert.Equal(availableSeatId, invite.ResultingSeatId);
        harness.UserTenantMembershipService.Verify(
            service => service.AddUserToTenantWithinTransactionAsync(
                userId,
                tenantId,
                AuthRoles.Developer,
                false,
                invite.InvitedByUserId,
                It.IsAny<CancellationToken>()),
            Times.Once);
        harness.UserTenantMembershipService.Verify(
            service => service.AddUserToTenantAsync(
                It.IsAny<Guid>(),
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<bool>(),
                It.IsAny<Guid?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private static TenantInvite CreatePendingInvite(Guid tenantId)
    {
        return new TenantInvite
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = InviteEmail,
            NormalizedEmail = NormalizedInviteEmail,
            TokenHash = "token-hash",
            TokenExpiresAt = DateTime.UtcNow.AddDays(1),
            Status = TenantInviteStatuses.Pending,
            InvitedByUserId = Guid.NewGuid()
        };
    }

    private static SeatDto CreateSeatDto(Guid seatId, Guid userId)
    {
        return new SeatDto
        {
            SeatId = seatId,
            UserId = userId,
            Status = "Active",
            IsBundled = false,
            SeatStartDate = DateTimeOffset.UtcNow
        };
    }

    /// <summary>
    /// Wires a <see cref="TenantInviteService"/> with mocked collaborators for the accept path.
    /// Defaults: invite found by token, user found and email-matched, membership already present,
    /// no available seats, tenant resolved with the supplied tier.
    /// </summary>
    private sealed class TestHarness
    {
        public Mock<ITenantInviteRepository> TenantInviteRepository { get; } = new();
        public Mock<ITenantRepository> TenantRepository { get; } = new();
        public Mock<IUserTenantMembershipRepository> UserTenantMembershipRepository { get; } = new();
        public Mock<IUserTenantMembershipService> UserTenantMembershipService { get; } = new();
        public Mock<ISeatManagementService> SeatManagementService { get; } = new();
        public Mock<ISubscriptionTierService> SubscriptionTierService { get; } = new();
        public Mock<ISubscriptionSeatRepository> SubscriptionSeatRepository { get; } = new();
        public Mock<IEmailSenderService> EmailSender { get; } = new();
        public Mock<IUserProvisioningService> UserProvisioningService { get; } = new();
        public Mock<IInternalDevTenantService> InternalDevTenantService { get; } = new();
        public Mock<UserManager<ApplicationUser>> UserManager { get; }
        public ManualResetEventSlim AdminNotificationSent { get; } = new(false);
        public TenantInviteService Service { get; }

        private readonly Guid _tenantId;

        public TestHarness(
            Guid tenantId,
            Guid userId,
            TenantInvite invite,
            string tier,
            bool isPerSeatTier,
            bool isInternalDevTenant = false)
        {
            _tenantId = tenantId;

            ApplicationUser user = new ApplicationUser
            {
                Id = userId,
                Email = InviteEmail,
                NormalizedEmail = NormalizedInviteEmail,
                IsActive = true,
                TenantId = tenantId
            };

            Tenant tenant = new Tenant
            {
                TenantId = tenantId,
                TenantName = "tenant-name",
                DisplayName = "Tenant",
                SubscriptionTier = tier,
                IsActive = true
            };

            TenantInviteRepository
                .Setup(repository => repository.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

            TenantRepository
                .Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(tenant);

            UserTenantMembershipRepository
                .Setup(repository => repository.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            UserTenantMembershipRepository
                .Setup(repository => repository.GetByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new UserTenantMembership
                {
                    UserId = userId,
                    TenantId = tenantId,
                    Role = AuthRoles.Developer,
                    Status = MembershipStatus.Active,
                });

            UserTenantMembershipRepository
                .Setup(repository => repository.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<UserTenantMembership>());

            SubscriptionSeatRepository
                .Setup(repository => repository.GetAvailableSeatsAsync(tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<SubscriptionSeat>());

            SubscriptionTierService
                .Setup(service => service.IsPerSeatTier(It.IsAny<string>()))
                .Returns(isPerSeatTier);

            InternalDevTenantService
                .Setup(service => service.IsInternalDevTenant(tenantId))
                .Returns(isInternalDevTenant);

            EmailSender
                .Setup(sender => sender.SendSeatPurchaseFailedAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask)
                .Callback(() => AdminNotificationSent.Set());

            UserManager = new Mock<UserManager<ApplicationUser>>(
                Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);
            UserManager
                .Setup(manager => manager.FindByIdAsync(userId.ToString()))
                .ReturnsAsync(user);

            UserTenantMembershipService
                .Setup(service => service.GetCurrentTenantAsync(userId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Ok<UserTenantMembership?>(null));
            UserTenantMembershipService
                .Setup(service => service.SetDefaultTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Ok());

            Service = new TenantInviteService(
                NullLogger<TenantInviteService>.Instance,
                TenantInviteRepository.Object,
                TenantRepository.Object,
                UserTenantMembershipRepository.Object,
                UserTenantMembershipService.Object,
                SeatManagementService.Object,
                SubscriptionTierService.Object,
                InternalDevTenantService.Object,
                SubscriptionSeatRepository.Object,
                EmailSender.Object,
                UserManager.Object,
                UserProvisioningService.Object,
                new Mock<IAuthResponseService>().Object,
                new Mock<IUserService>().Object,
                Options.Create(new TenantInviteConfiguration()),
                Options.Create(new AuthenticationConfiguration()));
        }

        public void WithNoLiveMembership(Guid userId)
        {
            UserTenantMembershipRepository
                .Setup(repository => repository.ExistsAsync(userId, _tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            UserTenantMembershipRepository
                .Setup(repository => repository.GetByUserAndTenantAsync(userId, _tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((UserTenantMembership?)null);
        }

        public void WithAvailableSeat(Guid seatId)
        {
            SubscriptionSeat seat = new SubscriptionSeat
            {
                SubscriptionSeatId = seatId,
                TenantId = _tenantId,
                Status = "Active",
                IsBundled = true,
                SeatStartDate = DateTimeOffset.UtcNow
            };

            SubscriptionSeatRepository
                .Setup(repository => repository.GetAvailableSeatsAsync(_tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new[] { seat });
        }

        public void WithExistingUserSeat(Guid userId, Guid seatId)
        {
            SubscriptionSeat seat = new SubscriptionSeat
            {
                SubscriptionSeatId = seatId,
                TenantId = _tenantId,
                UserId = userId,
                Status = "Active",
                IsBundled = false,
                SeatStartDate = DateTimeOffset.UtcNow
            };

            SubscriptionSeatRepository
                .Setup(repository => repository.GetByUserAsync(_tenantId, userId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(seat);
        }

        public void WithTenantAdminRecipient(string email)
        {
            UserTenantMembership membership = new UserTenantMembership
            {
                TenantId = _tenantId,
                UserId = Guid.NewGuid(),
                Role = AuthRoles.TenantAdmin,
                User = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    Email = email,
                    IsActive = true,
                    EmailNotificationsEnabled = true
                }
            };

            UserTenantMembershipRepository
                .Setup(repository => repository.GetByTenantIdAsync(_tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new[] { membership });
        }
    }
}
