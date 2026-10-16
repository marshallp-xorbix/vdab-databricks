using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Tests for admin user creation joining an optional tenant via <see cref="AddUserRequest.TenantId"/>
/// and for <see cref="IUserProvisioningService.AddExistingUserToTenantAsync"/>.
/// </summary>
public class UserProvisioningServiceTenantMembershipTests
{
    private readonly Mock<UserManager<ApplicationUser>> _userManager = new(
        Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);
    private readonly Mock<IEmailSenderService> _emailSender = new();
    private readonly Mock<ITenantService> _tenantService = new();
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();
    private readonly Mock<ISeatManagementService> _seatManagementService = new();

    [Fact]
    public async Task CreateUserAsync_WithTenantId_AddsMembershipWithoutWritingTenantId()
    {
        Guid adminId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid createdUserId = Guid.NewGuid();

        SetupSuccessfulUserCreate(createdUserId, AuthRoles.Developer);
        SetupActiveTenant(tenantId);
        SetupMembershipAdd(createdUserId, tenantId, AuthRoles.Developer, isDefault: true, adminId);
        SetupOpenSeatAssign(tenantId, createdUserId);

        UserProvisioningService service = CreateService();

        Result<ApplicationUser> result = await service.CreateUserAsync(
            new AddUserRequest
            {
                Email = "new.user@example.com",
                FirstName = "New",
                LastName = "User",
                Roles = [AuthRoles.Developer],
                TenantId = tenantId,
                SendWelcomeEmail = false,
            },
            adminId,
            callerActiveTenantId: tenantId,
            callerIsGlobalAdministrator: true);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.TenantId);
        _membershipService.Verify(
            service => service.AddUserToTenantAsync(
                createdUserId, tenantId, AuthRoles.Developer, true, adminId, It.IsAny<CancellationToken>()),
            Times.Once);
        _seatManagementService.Verify(
            service => service.TryAssignOpenSeatIfAllowedAsync(
                tenantId, createdUserId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task CreateUserAsync_WithoutTenantId_DoesNotAddMembership()
    {
        Guid adminId = Guid.NewGuid();
        Guid createdUserId = Guid.NewGuid();

        SetupSuccessfulUserCreate(createdUserId, AuthRoles.Developer);

        UserProvisioningService service = CreateService();

        Result<ApplicationUser> result = await service.CreateUserAsync(
            new AddUserRequest
            {
                Email = "orphan@example.com",
                FirstName = "Orphan",
                LastName = "User",
                Roles = [AuthRoles.Developer],
                SendWelcomeEmail = false,
            },
            adminId);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.TenantId);
        _membershipService.Verify(
            service => service.AddUserToTenantAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateUserAsync_WithAdminIdentityRole_MapsMembershipToTenantAdmin()
    {
        Guid adminId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid createdUserId = Guid.NewGuid();

        SetupSuccessfulUserCreate(createdUserId, AuthRoles.TenantAdmin);
        SetupActiveTenant(tenantId);
        SetupMembershipAdd(createdUserId, tenantId, AuthRoles.TenantAdmin, isDefault: true, adminId);
        SetupOpenSeatAssign(tenantId, createdUserId);

        UserProvisioningService service = CreateService();

        Result<ApplicationUser> result = await service.CreateUserAsync(
            new AddUserRequest
            {
                Email = "tenant.admin@example.com",
                FirstName = "Tenant",
                LastName = "Admin",
                Roles = [AuthRoles.TenantAdmin],
                TenantId = tenantId,
                SendWelcomeEmail = false,
            },
            adminId,
            callerActiveTenantId: tenantId,
            callerIsGlobalAdministrator: false);

        Assert.True(result.IsSuccess);
        _membershipService.Verify(
            service => service.AddUserToTenantAsync(
                createdUserId, tenantId, AuthRoles.TenantAdmin, true, adminId, It.IsAny<CancellationToken>()),
            Times.Once);
        _seatManagementService.Verify(
            service => service.TryAssignOpenSeatIfAllowedAsync(
                tenantId, createdUserId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task CreateUserAsync_NonGlobalAdmin_CrossTenantPlacement_ReturnsForbidden()
    {
        Guid adminId = Guid.NewGuid();
        Guid callerTenantId = Guid.NewGuid();
        Guid otherTenantId = Guid.NewGuid();

        UserProvisioningService service = CreateService();

        Result<ApplicationUser> result = await service.CreateUserAsync(
            new AddUserRequest
            {
                Email = "cross.tenant@example.com",
                FirstName = "Cross",
                LastName = "Tenant",
                Roles = [AuthRoles.Developer],
                TenantId = otherTenantId,
                SendWelcomeEmail = false,
            },
            adminId,
            callerActiveTenantId: callerTenantId,
            callerIsGlobalAdministrator: false);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, error => error is ForbiddenError);
        _userManager.Verify(manager => manager.CreateAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task AddExistingUserToTenantAsync_ValidRequest_AddsMembershipAndAssignsSeat()
    {
        Guid adminId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();
        ApplicationUser targetUser = new()
        {
            Id = targetId,
            Email = "member@example.com",
            UserName = "member@example.com",
            TenantId = null,
        };

        _userManager
            .Setup(manager => manager.FindByIdAsync(targetId.ToString()))
            .ReturnsAsync(targetUser);
        _userManager
            .Setup(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync(IdentityResult.Success);

        SetupActiveTenant(tenantId);
        SetupMembershipAdd(targetId, tenantId, AuthRoles.Developer, isDefault: false, adminId);
        SetupOpenSeatAssign(tenantId, targetId);

        UserProvisioningService service = CreateService();

        Result<TenantMemberRoleResponse> result = await service.AddExistingUserToTenantAsync(
            targetId,
            tenantId,
            AuthRoles.Developer,
            isDefault: false,
            addedByUserId: adminId);

        Assert.True(result.IsSuccess);
        Assert.Equal(tenantId, result.Value.TenantId);
        Assert.Equal(targetId, result.Value.UserId);
        Assert.Equal(AuthRoles.Developer, result.Value.Role);
        Assert.Null(targetUser.TenantId);
        _userManager.Verify(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()), Times.Never);
        _seatManagementService.Verify(
            service => service.TryAssignOpenSeatIfAllowedAsync(
                tenantId, targetId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task AddExistingUserToTenantAsync_InvalidRole_ReturnsBadRequest()
    {
        Guid adminId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        UserProvisioningService service = CreateService();

        Result<TenantMemberRoleResponse> result = await service.AddExistingUserToTenantAsync(
            targetId,
            tenantId,
            AuthRoles.Administrator,
            isDefault: false,
            addedByUserId: adminId);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, error => error is BadRequestError);
        _membershipService.Verify(
            service => service.AddUserToTenantAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task AddExistingUserToTenantAsync_UserNotFound_ReturnsNotFound()
    {
        Guid adminId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _userManager
            .Setup(manager => manager.FindByIdAsync(targetId.ToString()))
            .ReturnsAsync((ApplicationUser?)null);

        UserProvisioningService service = CreateService();

        Result<TenantMemberRoleResponse> result = await service.AddExistingUserToTenantAsync(
            targetId,
            tenantId,
            AuthRoles.Developer,
            isDefault: false,
            addedByUserId: adminId);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, error => error is NotFoundError);
    }

    [Fact]
    public async Task AddExistingUserToTenantAsync_InactiveTenant_ReturnsForbidden()
    {
        Guid adminId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _userManager
            .Setup(manager => manager.FindByIdAsync(targetId.ToString()))
            .ReturnsAsync(new ApplicationUser { Id = targetId, Email = "a@b.com", UserName = "a@b.com" });

        _tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant
            {
                TenantId = tenantId,
                TenantName = "acme",
                DisplayName = "Acme",
                IsActive = false,
            }));

        UserProvisioningService service = CreateService();

        Result<TenantMemberRoleResponse> result = await service.AddExistingUserToTenantAsync(
            targetId,
            tenantId,
            AuthRoles.Developer,
            isDefault: false,
            addedByUserId: adminId);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, error => error is ForbiddenError);
        _membershipService.Verify(
            service => service.AddUserToTenantAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private void SetupSuccessfulUserCreate(Guid createdUserId, string role)
    {
        _userManager
            .Setup(manager => manager.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((ApplicationUser?)null);
        _userManager
            .Setup(manager => manager.CreateAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync((ApplicationUser user) =>
            {
                user.Id = createdUserId;
                return IdentityResult.Success;
            });
        _userManager
            .Setup(manager => manager.AddToRolesAsync(It.IsAny<ApplicationUser>(), It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(IdentityResult.Success);
        _userManager
            .Setup(manager => manager.GetRolesAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync([role]);
        _userManager
            .Setup(manager => manager.UpdateAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync(IdentityResult.Success);
        _userManager
            .Setup(manager => manager.GenerateEmailConfirmationTokenAsync(It.IsAny<ApplicationUser>()))
            .ReturnsAsync("token");
    }

    private void SetupActiveTenant(Guid tenantId)
    {
        _tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant
            {
                TenantId = tenantId,
                TenantName = "acme",
                DisplayName = "Acme",
                IsActive = true,
            }));
    }

    private void SetupMembershipAdd(
        Guid userId,
        Guid tenantId,
        string role,
        bool isDefault,
        Guid addedByUserId)
    {
        _membershipService
            .Setup(service => service.AddUserToTenantAsync(
                userId,
                tenantId,
                role,
                isDefault,
                addedByUserId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserTenantMembership
            {
                UserId = userId,
                TenantId = tenantId,
                Role = role,
                IsDefault = isDefault,
            }));
    }

    private void SetupOpenSeatAssign(Guid tenantId, Guid userId)
    {
        _seatManagementService
            .Setup(service => service.TryAssignOpenSeatIfAllowedAsync(
                tenantId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
    }

    private UserProvisioningService CreateService()
    {
        Mock<IUserLifecycleService> lifecycle = new();
        lifecycle
            .Setup(s => s.TryAnonymizeStaleRetiredByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        return new UserProvisioningService(
            NullLogger<UserProvisioningService>.Instance,
            _userManager.Object,
            _emailSender.Object,
            _tenantService.Object,
            _membershipService.Object,
            _seatManagementService.Object,
            lifecycle.Object,
            Options.Create(new PolicyConsentConfiguration()),
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = false }));
    }
}
