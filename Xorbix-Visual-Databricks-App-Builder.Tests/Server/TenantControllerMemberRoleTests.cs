using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Tests for the tenant member-role endpoints on <see cref="TenantController"/>, covering
/// role validity, self-change prevention, and the role-hierarchy guards that stop a caller
/// from assigning above their level or modifying a member who outranks them.
/// </summary>
public class TenantControllerMemberRoleTests
{
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();
    private readonly Mock<ISeatManagementService> _seatManagementService = new();
    private readonly Mock<ITenantService> _tenantService = new();
    private readonly Mock<IUserProvisioningService> _userProvisioningService = new();

    private TenantController CreateController()
    {
        // By default the tenant has no owner, so the owner-protection guard passes through.
        _tenantService
            .Setup(service => service.GetTenantAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant { TenantName = "tenant", DisplayName = "Tenant", OwnerId = null }));

        return new TenantController(
            Mock.Of<IAuthService>(),
            _membershipService.Object,
            _tenantService.Object,
            Mock.Of<ITenantLifecycleService>(),
            _seatManagementService.Object,
            Mock.Of<IStripeSubscriptionService>(),
            _userProvisioningService.Object,
            Mock.Of<IPersonalWorkspaceService>(),
            NullLogger<TenantController>.Instance);
    }

    [Fact]
    public async Task UpdateMemberRole_AssigningAdministratorRole_ReturnsBadRequest()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRole(
            targetId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.Administrator });

        Assert.Equal(StatusCodes.Status400BadRequest, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task UpdateMemberRole_InvalidRole_ReturnsBadRequest()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRole(
            targetId, new UpdateTenantMemberRoleRequest { Role = "Wizard" });

        Assert.Equal(StatusCodes.Status400BadRequest, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task UpdateMemberRole_ChangingOwnRole_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRole(
            callerId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.Developer });

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task UpdateMemberRole_DeveloperAssigningAdminRole_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.Developer);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRole(
            targetId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.TenantAdmin });

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task UpdateMemberRole_TargetOutranksCaller_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.TenantAdmin));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.Developer);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRole(
            targetId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.Developer });

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        _membershipService.Verify(
            service => service.UpdateUserRoleInTenantAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateMemberRole_AdminAssigningDeveloperToPeer_ReturnsOk()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));
        _membershipService
            .Setup(service => service.UpdateUserRoleInTenantAsync(targetId, tenantId, AuthRoles.Developer, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserTenantMembership
            {
                UserId = targetId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
            }));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRole(
            targetId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.Developer });

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        TenantMemberRoleResponse payload = Assert.IsType<TenantMemberRoleResponse>(
            Assert.IsType<OkObjectResult>(response.Result).Value);
        Assert.Equal(AuthRoles.Developer, payload.Role);
    }

    [Fact]
    public async Task GetMemberRole_ReturnsRoleForCurrentTenant()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.GetLiveMembershipAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserTenantMembership
            {
                UserId = targetId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                Status = MembershipStatus.Active,
            }));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response = await controller.GetMemberRole(targetId);

        TenantMemberRoleResponse payload = Assert.IsType<TenantMemberRoleResponse>(
            Assert.IsType<OkObjectResult>(response.Result).Value);
        Assert.Equal(tenantId, payload.TenantId);
        Assert.Equal(targetId, payload.UserId);
        Assert.Equal(AuthRoles.Developer, payload.Role);
        Assert.Equal(MembershipStatus.Active.ToString(), payload.Status);
    }

    [Fact]
    public async Task RemoveMember_RemovingSelf_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        IActionResult response = await controller.RemoveMember(callerId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _seatManagementService.Verify(
            service => service.RemoveMemberAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RemoveMember_TargetOutranksCaller_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.TenantAdmin));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.Developer);

        IActionResult response = await controller.RemoveMember(targetId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _seatManagementService.Verify(
            service => service.RemoveMemberAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RemoveMember_AdminRemovingDeveloper_DelegatesToServiceAndReturnsOk()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));
        _seatManagementService
            .Setup(service => service.RemoveMemberAsync(tenantId, targetId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        IActionResult response = await controller.RemoveMember(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _seatManagementService.Verify(
            service => service.RemoveMemberAsync(tenantId, targetId, callerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task UpdateMemberRole_TargetIsOwnerAndCallerNotOwner_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));

        TenantController controller = CreateController();
        _tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant { TenantName = "tenant", DisplayName = "Tenant", OwnerId = ownerId }));
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRole(
            ownerId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.Developer });

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        _membershipService.Verify(
            service => service.UpdateUserRoleInTenantAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RemoveMember_TargetIsOwnerAndCallerNotOwner_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.GetUserRoleInTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));

        TenantController controller = CreateController();
        _tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant { TenantName = "tenant", DisplayName = "Tenant", OwnerId = ownerId }));
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        IActionResult response = await controller.RemoveMember(ownerId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _seatManagementService.Verify(
            service => service.RemoveMemberAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task TransferOwnership_CallerIsOwner_DelegatesToServiceAndReturnsOk()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        TenantController controller = CreateController();
        _tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant { TenantName = "tenant", DisplayName = "Tenant", OwnerId = callerId }));
        _tenantService
            .Setup(service => service.TransferOwnershipAsync(tenantId, targetId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant { TenantId = tenantId, TenantName = "tenant", DisplayName = "Tenant", OwnerId = targetId }));
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantDto> response = await controller.TransferOwnership(
            new TransferTenantOwnershipRequest { TargetUserId = targetId });

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        _tenantService.Verify(
            service => service.TransferOwnershipAsync(tenantId, targetId, callerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task TransferOwnership_CallerNotOwnerAndNotAdmin_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        TenantController controller = CreateController();
        _tenantService
            .Setup(service => service.GetTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant { TenantName = "tenant", DisplayName = "Tenant", OwnerId = ownerId }));
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantDto> response = await controller.TransferOwnership(
            new TransferTenantOwnershipRequest { TargetUserId = targetId });

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        _tenantService.Verify(
            service => service.TransferOwnershipAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateMemberRoleInTenant_AssigningAdministratorRole_ReturnsBadRequest()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRoleInTenant(
            tenantId, targetId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.Administrator });

        Assert.Equal(StatusCodes.Status400BadRequest, ControllerTestHelpers.StatusCodeOf(response.Result));
        _membershipService.Verify(
            service => service.UpdateUserRoleInTenantAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateMemberRoleInTenant_ChangingOwnRole_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRoleInTenant(
            tenantId, callerId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.Developer });

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        _membershipService.Verify(
            service => service.UpdateUserRoleInTenantAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateMemberRoleInTenant_AdminUpdatesRoleInArbitraryTenant_DelegatesToServiceAndReturnsOk()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.UpdateUserRoleInTenantAsync(targetId, tenantId, AuthRoles.TenantAdmin, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserTenantMembership
            {
                UserId = targetId,
                TenantId = tenantId,
                Role = AuthRoles.TenantAdmin,
            }));

        TenantController controller = CreateController();
        // The administrator is not a member of the target tenant (no tenant claim).
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        ActionResult<TenantMemberRoleResponse> response = await controller.UpdateMemberRoleInTenant(
            tenantId, targetId, new UpdateTenantMemberRoleRequest { Role = AuthRoles.TenantAdmin });

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        TenantMemberRoleResponse payload = Assert.IsType<TenantMemberRoleResponse>(
            Assert.IsType<OkObjectResult>(response.Result).Value);
        Assert.Equal(tenantId, payload.TenantId);
        Assert.Equal(targetId, payload.UserId);
        Assert.Equal(AuthRoles.TenantAdmin, payload.Role);
        _membershipService.Verify(
            service => service.UpdateUserRoleInTenantAsync(targetId, tenantId, AuthRoles.TenantAdmin, callerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task AddMemberToTenant_AssigningAdministratorRole_ReturnsBadRequest()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _userProvisioningService
            .Setup(service => service.AddExistingUserToTenantAsync(
                targetId, tenantId, AuthRoles.Administrator, false, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<TenantMemberRoleResponse>(
                new BadRequestError($"'{AuthRoles.Administrator}' is not a valid tenant role.")));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        ActionResult<TenantMemberRoleResponse> response = await controller.AddMemberToTenant(
            tenantId,
            new AddTenantMemberRequest { UserId = targetId, Role = AuthRoles.Administrator });

        Assert.Equal(StatusCodes.Status400BadRequest, ControllerTestHelpers.StatusCodeOf(response.Result));
        _userProvisioningService.Verify(
            service => service.AddExistingUserToTenantAsync(
                targetId, tenantId, AuthRoles.Administrator, false, callerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task AddMemberToTenant_UserNotFound_ReturnsNotFound()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _userProvisioningService
            .Setup(service => service.AddExistingUserToTenantAsync(
                targetId, tenantId, AuthRoles.Developer, false, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<TenantMemberRoleResponse>(new NotFoundError("User not found.")));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        ActionResult<TenantMemberRoleResponse> response = await controller.AddMemberToTenant(
            tenantId,
            new AddTenantMemberRequest { UserId = targetId, Role = AuthRoles.Developer });

        Assert.Equal(StatusCodes.Status404NotFound, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task AddMemberToTenant_AdminAddsMember_DelegatesToProvisioningService()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _userProvisioningService
            .Setup(service => service.AddExistingUserToTenantAsync(
                targetId, tenantId, AuthRoles.Developer, false, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new TenantMemberRoleResponse
            {
                UserId = targetId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                Status = MembershipStatus.Active.ToString(),
            }));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        ActionResult<TenantMemberRoleResponse> response = await controller.AddMemberToTenant(
            tenantId,
            new AddTenantMemberRequest { UserId = targetId, Role = AuthRoles.Developer });

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        TenantMemberRoleResponse payload = Assert.IsType<TenantMemberRoleResponse>(
            Assert.IsType<OkObjectResult>(response.Result).Value);
        Assert.Equal(tenantId, payload.TenantId);
        Assert.Equal(targetId, payload.UserId);
        Assert.Equal(AuthRoles.Developer, payload.Role);

        _userProvisioningService.Verify(
            service => service.AddExistingUserToTenantAsync(
                targetId, tenantId, AuthRoles.Developer, false, callerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task AddMemberToTenant_InactiveTenant_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _userProvisioningService
            .Setup(service => service.AddExistingUserToTenantAsync(
                targetId, tenantId, AuthRoles.Developer, false, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<TenantMemberRoleResponse>(new ForbiddenError("Tenant is inactive.")));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        ActionResult<TenantMemberRoleResponse> response = await controller.AddMemberToTenant(
            tenantId,
            new AddTenantMemberRequest { UserId = targetId, Role = AuthRoles.Developer });

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task RemoveMemberFromTenant_RemovingSelf_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        _seatManagementService
            .Setup(service => service.RemoveMemberAsync(tenantId, callerId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new ForbiddenError("You cannot remove yourself from a tenant.")));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        IActionResult response = await controller.RemoveMemberFromTenant(tenantId, callerId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _seatManagementService.Verify(
            service => service.RemoveMemberAsync(tenantId, callerId, callerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RemoveMemberFromTenant_TenantNotFound_ReturnsNotFound()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _seatManagementService
            .Setup(service => service.RemoveMemberAsync(tenantId, targetId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new NotFoundError("Tenant not found.")));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        IActionResult response = await controller.RemoveMemberFromTenant(tenantId, targetId);

        Assert.Equal(StatusCodes.Status404NotFound, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _seatManagementService.Verify(
            service => service.RemoveMemberAsync(tenantId, targetId, callerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RemoveMemberFromTenant_AdminRemovingMember_DelegatesToServiceAndReturnsOk()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _seatManagementService
            .Setup(service => service.RemoveMemberAsync(tenantId, targetId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, null, AuthRoles.Administrator);

        IActionResult response = await controller.RemoveMemberFromTenant(tenantId, targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _seatManagementService.Verify(
            service => service.RemoveMemberAsync(tenantId, targetId, callerId, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}

