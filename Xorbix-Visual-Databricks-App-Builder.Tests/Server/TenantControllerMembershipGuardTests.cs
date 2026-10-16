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
/// Suspend/Resume share RemoveMember's self / rank / tenant-owner guards.
/// </summary>
public class TenantControllerMembershipGuardTests
{
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();
    private readonly Mock<ISeatManagementService> _seatManagementService = new();
    private readonly Mock<ITenantService> _tenantService = new();

    private TenantController CreateController(Guid? ownerId = null)
    {
        _tenantService
            .Setup(service => service.GetTenantAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new Tenant
            {
                TenantName = "tenant",
                DisplayName = "Tenant",
                OwnerId = ownerId,
            }));

        return new TenantController(
            Mock.Of<IAuthService>(),
            _membershipService.Object,
            _tenantService.Object,
            Mock.Of<ITenantLifecycleService>(),
            _seatManagementService.Object,
            Mock.Of<IStripeSubscriptionService>(),
            Mock.Of<IUserProvisioningService>(),
            Mock.Of<IPersonalWorkspaceService>(),
            NullLogger<TenantController>.Instance);
    }

    [Fact]
    public async Task SuspendMember_Self_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response =
            await controller.SuspendMember(callerId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        _membershipService.Verify(
            s => s.SuspendMembershipAsync(
                It.IsAny<Guid>(),
                It.IsAny<Guid>(),
                It.IsAny<Guid>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResumeMember_Self_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response =
            await controller.ResumeMember(callerId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task SuspendMember_HigherRankedTarget_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(s => s.GetUserRoleInTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.TenantAdmin));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.Developer);

        ActionResult<TenantMemberRoleResponse> response =
            await controller.SuspendMember(targetId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task SuspendMember_TenantOwner_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid ownerId = Guid.NewGuid();

        _membershipService
            .Setup(s => s.GetUserRoleInTenantAsync(ownerId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.TenantAdmin));

        TenantController controller = CreateController(ownerId);
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response =
            await controller.SuspendMember(ownerId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task SuspendMember_PeerDeveloper_ReturnsOk()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(s => s.GetUserRoleInTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));
        _membershipService
            .Setup(s => s.SuspendMembershipAsync(targetId, tenantId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserTenantMembership
            {
                UserId = targetId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                Status = MembershipStatus.Suspended,
            }));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response =
            await controller.SuspendMember(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task ResumeMember_PeerDeveloper_ReturnsOk()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(s => s.GetUserRoleInTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(AuthRoles.Developer));
        _membershipService
            .Setup(s => s.ResumeMembershipAsync(targetId, tenantId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserTenantMembership
            {
                UserId = targetId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                Status = MembershipStatus.Active,
            }));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response =
            await controller.ResumeMember(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task RestoreMember_OnSuccess_CallsTryAssignOpenSeatIfAllowedAsync()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(s => s.RestoreMembershipAsync(targetId, tenantId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserTenantMembership
            {
                UserId = targetId,
                TenantId = tenantId,
                Role = AuthRoles.Developer,
                Status = MembershipStatus.Active,
            }));
        _seatManagementService
            .Setup(s => s.TryAssignOpenSeatIfAllowedAsync(tenantId, targetId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response =
            await controller.RestoreMember(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        _seatManagementService.Verify(
            s => s.TryAssignOpenSeatIfAllowedAsync(tenantId, targetId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RestoreMember_OnFailure_DoesNotAssignSeat()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(s => s.RestoreMembershipAsync(targetId, tenantId, callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<UserTenantMembership>(new ConflictError("User is already a member of this tenant")));

        TenantController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<TenantMemberRoleResponse> response =
            await controller.RestoreMember(targetId);

        Assert.Equal(StatusCodes.Status409Conflict, ControllerTestHelpers.StatusCodeOf(response.Result));
        _seatManagementService.Verify(
            s => s.TryAssignOpenSeatIfAllowedAsync(
                It.IsAny<Guid>(),
                It.IsAny<Guid>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
