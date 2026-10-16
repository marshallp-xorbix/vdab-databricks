using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

/// <summary>
/// Tests for user-initiated personal workspace creation (Detached → Incomplete tenant).
/// Token minting must not call this path — see AuthResponseService (no EnsurePersonalTenant).
/// </summary>
public class PersonalWorkspaceServiceTests
{
    private readonly Mock<UserManager<ApplicationUser>> _userManager = new(
        Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();
    private readonly Mock<ITenantService> _tenantService = new();
    private readonly IAccountAccessPolicy _accountAccessPolicy = new AccountAccessPolicy();

    [Fact]
    public async Task CreatePersonalWorkspaceAsync_UserWithActiveMembership_ReturnsConflict()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new() { Id = userId, IsActive = true, TenantId = Guid.NewGuid() };

        _userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _userManager.Setup(m => m.IsInRoleAsync(user, AuthRoles.Administrator)).ReturnsAsync(false);
        _membershipService
            .Setup(s => s.GetUserTenantsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<IEnumerable<UserTenantMembership>>(
            [
                new UserTenantMembership { UserId = userId, TenantId = user.TenantId!.Value, Role = AuthRoles.Developer }
            ]));

        PersonalWorkspaceService service = CreateService();

        Result<TenantDto> result = await service.CreatePersonalWorkspaceAsync(userId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
        _tenantService.Verify(
            s => s.CreateTenantAsync(
                It.IsAny<CreateTenantRequest>(),
                It.IsAny<Guid>(),
                It.IsAny<bool>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreatePersonalWorkspaceAsync_GlobalAdmin_ReturnsBadRequest()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new() { Id = userId, IsActive = true };

        _userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _userManager.Setup(m => m.IsInRoleAsync(user, AuthRoles.Administrator)).ReturnsAsync(true);

        PersonalWorkspaceService service = CreateService();

        Result<TenantDto> result = await service.CreatePersonalWorkspaceAsync(userId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
        _membershipService.Verify(
            s => s.GetUserTenantsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreatePersonalWorkspaceAsync_DetachedActiveUser_ProvisionsTenantWithoutTenantIdWrite()
    {
        Guid userId = Guid.NewGuid();
        Guid newTenantId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            Email = "detached@example.com",
            FirstName = "Detached",
            LastName = "User",
            IsActive = true,
            DeletedOn = null,
            TenantId = null,
        };

        _userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _userManager.Setup(m => m.IsInRoleAsync(user, AuthRoles.Administrator)).ReturnsAsync(false);
        _membershipService
            .Setup(s => s.GetUserTenantsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<IEnumerable<UserTenantMembership>>([]));
        _membershipService
            .Setup(s => s.HasLiveMembershipAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _tenantService
            .Setup(s => s.CreateTenantAsync(
                It.IsAny<CreateTenantRequest>(),
                userId,
                true,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new TenantDto
            {
                TenantId = newTenantId,
                TenantName = $"user-{userId}",
                DisplayName = "Detached User's Workspace",
                IsActive = true,
                SubscriptionTier = "Individual",
                BillingCycle = "Monthly",
                MaxUsers = 1,
                MaxPublishedApps = 1,
                MaxWorkspaceConnections = 1,
                AutoRenew = false,
                SubscriptionStatus = SubscriptionStatusNames.Incomplete,
            }));

        PersonalWorkspaceService service = CreateService();

        Result<TenantDto> result = await service.CreatePersonalWorkspaceAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.Equal(newTenantId, result.Value.TenantId);
        Assert.True(user.IsActive);
        Assert.Null(user.DeletedOn);
        Assert.Null(user.TenantId);
        _userManager.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _tenantService.Verify(
            s => s.CreateTenantAsync(
                It.Is<CreateTenantRequest>(request =>
                    request.OwnerId == userId
                    && request.SubscriptionStatus == SubscriptionStatusNames.Incomplete),
                userId,
                true,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task CreatePersonalWorkspaceAsync_RetiredUser_ReturnsForbiddenWithoutClearingDeletedOn()
    {
        Guid userId = Guid.NewGuid();
        DateTime deletedOn = DateTime.UtcNow.AddDays(-1);
        Guid deletedBy = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = false,
            DeletedOn = deletedOn,
            DeletedBy = deletedBy,
            TenantId = null,
        };

        _userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        PersonalWorkspaceService service = CreateService();

        Result<TenantDto> result = await service.CreatePersonalWorkspaceAsync(userId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ForbiddenError>());
        Assert.False(user.IsActive);
        Assert.Equal(deletedOn, user.DeletedOn);
        Assert.Equal(deletedBy, user.DeletedBy);
        _tenantService.Verify(
            s => s.CreateTenantAsync(
                It.IsAny<CreateTenantRequest>(),
                It.IsAny<Guid>(),
                It.IsAny<bool>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        _userManager.Verify(m => m.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task CreatePersonalWorkspaceAsync_SuspendedOnlyMemberships_ReturnsConflict()
    {
        Guid userId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            IsActive = true,
            DeletedOn = null,
            TenantId = null,
        };

        _userManager.Setup(m => m.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _userManager.Setup(m => m.IsInRoleAsync(user, AuthRoles.Administrator)).ReturnsAsync(false);
        _membershipService
            .Setup(s => s.GetUserTenantsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<IEnumerable<UserTenantMembership>>([]));
        _membershipService
            .Setup(s => s.HasLiveMembershipAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        PersonalWorkspaceService service = CreateService();

        Result<TenantDto> result = await service.CreatePersonalWorkspaceAsync(userId);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
        _tenantService.Verify(
            s => s.CreateTenantAsync(
                It.IsAny<CreateTenantRequest>(),
                It.IsAny<Guid>(),
                It.IsAny<bool>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private PersonalWorkspaceService CreateService()
    {
        return new PersonalWorkspaceService(
            NullLogger<PersonalWorkspaceService>.Instance,
            _userManager.Object,
            _membershipService.Object,
            _tenantService.Object,
            _accountAccessPolicy);
    }
}
