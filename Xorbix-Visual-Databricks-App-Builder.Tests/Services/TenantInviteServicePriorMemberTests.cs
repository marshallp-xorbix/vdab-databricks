using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Covers §11.1 prior-member invite evaluate and confirm paths.
/// </summary>
public class TenantInviteServicePriorMemberTests
{
    private const string PriorEmail = "prior@example.com";

    [Fact]
    public async Task CreateInvitesAsync_WhenDetachedPriorMember_ReturnsPriorMemberChoiceRequired()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        DateTime removedOn = DateTime.UtcNow.AddDays(-10);
        ApplicationUser priorUser = new()
        {
            Id = userId,
            Email = PriorEmail,
            FirstName = "Pat",
            LastName = "Prior",
            DeletedOn = null,
            LastLoginAt = null,
        };
        UserTenantMembership softDeleted = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            DeletedOn = removedOn,
        };

        PriorMemberHarness harness = new(tenantId);
        harness.WithTenant();
        harness.WithSeatsAvailable(3);
        harness.UserManager.Setup(m => m.FindByEmailAsync(PriorEmail)).ReturnsAsync(priorUser);
        harness.MembershipRepository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        harness.MembershipRepository
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        harness.MembershipRepository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(softDeleted);
        harness.MembershipRepository
            .Setup(r => r.HasSoftDeletedInOtherTenantsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        Result<CreateInvitesResponse> result = await harness.Service.CreateInvitesAsync(
            tenantId,
            [PriorEmail],
            Guid.NewGuid());

        Assert.True(result.IsSuccess);
        InviteResultDto inviteResult = Assert.Single(result.Value.Results);
        Assert.Equal(InviteOutcome.PriorMemberChoiceRequired, inviteResult.Outcome);
        Assert.NotNull(inviteResult.PriorMember);
        Assert.True(inviteResult.PriorMember!.AllowDifferentPerson);
        Assert.Equal(AuthRoles.Developer, inviteResult.PriorMember.PriorRole);
        harness.InviteRepository.Verify(
            r => r.AddRangeAsync(It.IsAny<IEnumerable<TenantInvite>>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ConfirmPriorMemberChoiceAsync_ReAdd_CreatesRestoreInvite()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        ApplicationUser priorUser = new()
        {
            Id = userId,
            Email = PriorEmail,
            DeletedOn = null,
            LastLoginAt = null,
        };
        UserTenantMembership softDeleted = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.TenantAdmin,
            DeletedOn = DateTime.UtcNow.AddDays(-5),
        };

        PriorMemberHarness harness = new(tenantId);
        harness.WithTenant();
        harness.WithSeatsAvailable(3);
        harness.UserManager.Setup(m => m.FindByEmailAsync(PriorEmail)).ReturnsAsync(priorUser);
        harness.UserManager
            .Setup(m => m.FindByIdAsync(actingUserId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = actingUserId, FirstName = "Admin", LastName = "User" });
        harness.MembershipRepository
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        harness.MembershipRepository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        harness.MembershipRepository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(softDeleted);
        harness.InviteRepository
            .Setup(r => r.GetPendingByEmailAsync(tenantId, PriorEmail.ToUpperInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((TenantInvite?)null);
        harness.InviteRepository
            .Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<TenantInvite>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Result<PriorMemberChoiceResponse> result = await harness.Service.ConfirmPriorMemberChoiceAsync(
            tenantId,
            PriorEmail,
            PriorMemberChoice.ReAdd,
            actingUserId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.Equal(PriorMemberChoice.ReAdd, result.Value.Choice);
        Assert.Null(result.Value.RestoredMembership);
        Assert.NotNull(result.Value.InviteResponse);
        InviteResultDto inviteResult = Assert.Single(result.Value.InviteResponse!.Results);
        Assert.Equal(InviteOutcome.Created, inviteResult.Outcome);
        harness.MembershipService.Verify(
            s => s.RestoreMembershipAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        harness.UserService.Verify(
            s => s.SoftDeleteUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        harness.InviteRepository.Verify(
            r => r.AddRangeAsync(It.IsAny<IEnumerable<TenantInvite>>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ConfirmPriorMemberChoiceAsync_ReAdd_WhenActiveInOtherTenant_Succeeds()
    {
        Guid tenantId = Guid.NewGuid();
        Guid otherTenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        ApplicationUser priorUser = new()
        {
            Id = userId,
            Email = PriorEmail,
            DeletedOn = null,
            LastLoginAt = null,
        };
        UserTenantMembership softDeleted = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            DeletedOn = DateTime.UtcNow.AddDays(-5),
        };
        UserTenantMembership liveElsewhere = new()
        {
            UserId = userId,
            TenantId = otherTenantId,
            Role = AuthRoles.Developer,
            Status = MembershipStatus.Active,
            DeletedOn = null,
        };

        PriorMemberHarness harness = new(tenantId);
        harness.WithTenant();
        harness.WithSeatsAvailable(3);
        harness.UserManager.Setup(m => m.FindByEmailAsync(PriorEmail)).ReturnsAsync(priorUser);
        harness.UserManager
            .Setup(m => m.FindByIdAsync(actingUserId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = actingUserId, FirstName = "Admin", LastName = "User" });
        harness.MembershipRepository
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([liveElsewhere]);
        harness.MembershipRepository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        harness.MembershipRepository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(softDeleted);
        harness.InviteRepository
            .Setup(r => r.GetPendingByEmailAsync(tenantId, PriorEmail.ToUpperInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((TenantInvite?)null);
        harness.InviteRepository
            .Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<TenantInvite>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Result<PriorMemberChoiceResponse> result = await harness.Service.ConfirmPriorMemberChoiceAsync(
            tenantId,
            PriorEmail,
            PriorMemberChoice.ReAdd,
            actingUserId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.Equal(PriorMemberChoice.ReAdd, result.Value.Choice);
        Assert.NotNull(result.Value.InviteResponse);
        InviteResultDto inviteResult = Assert.Single(result.Value.InviteResponse!.Results);
        Assert.Equal(InviteOutcome.Created, inviteResult.Outcome);
    }

    [Fact]
    public async Task ConfirmPriorMemberChoiceAsync_DifferentPerson_WhenAllowed_SoftDeletesThenCreatesInvite()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        Guid actingUserId = Guid.NewGuid();
        DateTime removedOn = DateTime.UtcNow.AddDays(-10);
        ApplicationUser priorUser = new()
        {
            Id = userId,
            Email = PriorEmail,
            DeletedOn = null,
            LastLoginAt = null,
        };
        UserTenantMembership softDeleted = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            DeletedOn = removedOn,
        };

        PriorMemberHarness harness = new(tenantId);
        harness.WithTenant();
        harness.WithSeatsAvailable(3);
        harness.UserManager.Setup(m => m.FindByEmailAsync(PriorEmail)).ReturnsAsync(priorUser);
        harness.UserManager
            .Setup(m => m.FindByIdAsync(actingUserId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = actingUserId, FirstName = "Admin", LastName = "User" });
        harness.MembershipRepository
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        harness.MembershipRepository
            .Setup(r => r.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        harness.MembershipRepository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(softDeleted);
        harness.InviteRepository
            .Setup(r => r.GetPendingByEmailAsync(tenantId, PriorEmail.ToUpperInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((TenantInvite?)null);
        harness.InviteRepository
            .Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<TenantInvite>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        harness.UserService
            .Setup(s => s.SoftDeleteUserAsync(userId, actingUserId, It.IsAny<CancellationToken>()))
            .Callback(() => priorUser.DeletedOn = DateTime.UtcNow)
            .ReturnsAsync(Result.Ok());

        Result<PriorMemberChoiceResponse> result = await harness.Service.ConfirmPriorMemberChoiceAsync(
            tenantId,
            PriorEmail,
            PriorMemberChoice.DifferentPerson,
            actingUserId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(e => e.Message)));
        Assert.Equal(PriorMemberChoice.DifferentPerson, result.Value.Choice);
        Assert.NotNull(result.Value.InviteResponse);
        InviteResultDto inviteResult = Assert.Single(result.Value.InviteResponse!.Results);
        Assert.Equal(InviteOutcome.Created, inviteResult.Outcome);
        harness.UserService.Verify(
            s => s.SoftDeleteUserAsync(userId, actingUserId, It.IsAny<CancellationToken>()),
            Times.Once);
        harness.InviteRepository.Verify(
            r => r.AddRangeAsync(It.IsAny<IEnumerable<TenantInvite>>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ConfirmPriorMemberChoiceAsync_DifferentPerson_WhenSignedInSinceRemoval_ReturnsForbidden()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        DateTime removedOn = DateTime.UtcNow.AddDays(-10);
        ApplicationUser priorUser = new()
        {
            Id = userId,
            Email = PriorEmail,
            DeletedOn = null,
            LastLoginAt = removedOn.AddDays(1),
        };
        UserTenantMembership softDeleted = new()
        {
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            DeletedOn = removedOn,
        };

        PriorMemberHarness harness = new(tenantId);
        harness.UserManager.Setup(m => m.FindByEmailAsync(PriorEmail)).ReturnsAsync(priorUser);
        harness.MembershipRepository
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        harness.MembershipRepository
            .Setup(r => r.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(softDeleted);

        Result<PriorMemberChoiceResponse> result = await harness.Service.ConfirmPriorMemberChoiceAsync(
            tenantId,
            PriorEmail,
            PriorMemberChoice.DifferentPerson,
            Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
        harness.UserService.Verify(
            s => s.SoftDeleteUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private sealed class PriorMemberHarness
    {
        public Mock<ITenantInviteRepository> InviteRepository { get; } = new();
        public Mock<ITenantRepository> TenantRepository { get; } = new();
        public Mock<IUserTenantMembershipRepository> MembershipRepository { get; } = new();
        public Mock<IUserTenantMembershipService> MembershipService { get; } = new();
        public Mock<ISeatManagementService> SeatManagementService { get; } = new();
        public Mock<IUserService> UserService { get; } = new();
        public Mock<UserManager<ApplicationUser>> UserManager { get; }
        public TenantInviteService Service { get; }

        private readonly Guid _tenantId;

        public PriorMemberHarness(Guid tenantId)
        {
            _tenantId = tenantId;
            UserManager = new Mock<UserManager<ApplicationUser>>(
                Mock.Of<IUserStore<ApplicationUser>>(),
                null!, null!, null!, null!, null!, null!, null!, null!);

            MembershipService
                .Setup(s => s.EnsureWithinReinstatementWindow(It.IsAny<UserTenantMembership>()))
                .Returns(Result.Ok());

            Service = new TenantInviteService(
                NullLogger<TenantInviteService>.Instance,
                InviteRepository.Object,
                TenantRepository.Object,
                MembershipRepository.Object,
                MembershipService.Object,
                SeatManagementService.Object,
                new Mock<ISubscriptionTierService>().Object,
                new Mock<IInternalDevTenantService>().Object,
                new Mock<ISubscriptionSeatRepository>().Object,
                new Mock<IEmailSenderService>().Object,
                UserManager.Object,
                new Mock<IUserProvisioningService>().Object,
                new Mock<IAuthResponseService>().Object,
                UserService.Object,
                Options.Create(new TenantInviteConfiguration()),
                Options.Create(new AuthenticationConfiguration()));
        }

        public void WithTenant()
        {
            TenantRepository
                .Setup(r => r.GetByIdAsync(_tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Tenant
                {
                    TenantId = _tenantId,
                    TenantName = "tenant",
                    DisplayName = "Tenant",
                });
        }

        public void WithSeatsAvailable(int available)
        {
            SeatManagementService
                .Setup(s => s.GetSeatSummaryAsync(_tenantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Ok(new SeatSummaryDto
                {
                    AvailableSeats = available,
                    TotalSeats = available,
                    OccupiedSeats = 0,
                    BundledSeats = available,
                    ExtraSeats = 0,
                    PendingCancellationSeats = 0,
                }));
        }
    }
}
