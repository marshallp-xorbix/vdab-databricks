using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Authorization tests for the tenant-scoping guard on <see cref="UserController"/>.
/// Verifies that tenant admins cannot reach into other tenants for membership-scoped reads,
/// and that account mutations are self or Xorbix only (Phase 4).
/// </summary>
public class UserControllerTenantScopeTests
{
    private readonly Mock<IUserService> _userService = new();
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();

    private UserController CreateController()
    {
        return new UserController(
            NullLogger<UserController>.Instance,
            _userService.Object,
            Mock.Of<IUserProvisioningService>(),
            Mock.Of<IUserLifecycleService>(),
            Mock.Of<IUserSessionService>(),
            Mock.Of<ISessionTokenSecurityService>(),
            _membershipService.Object,
            Mock.Of<IAuthService>());
    }

    [Fact]
    public async Task GetUser_TenantAdminViewingNonMember_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.UserBelongsToTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<ApplicationUser> response = await controller.GetUser(targetId);

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        _userService.Verify(service => service.GetUserByIdAsync(targetId, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetUser_TenantAdminViewingGuestMember_ReturnsOk()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(service => service.UserBelongsToTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _userService
            .Setup(service => service.GetUserByIdAsync(targetId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new ApplicationUser { Id = targetId, TenantId = Guid.NewGuid() }));

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<ApplicationUser> response = await controller.GetUser(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task UpdateUser_TenantAdminUpdatingMember_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<ApplicationUser> response = await controller.UpdateUser(targetId, BuildUpdateRequest());

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        _userService.Verify(
            service => service.UpdateUserAsync(It.IsAny<Guid>(), It.IsAny<UpdateUserRequest>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateUser_TenantAdminUpdatingOwnedUser_ReturnsForbidden()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<ApplicationUser> response = await controller.UpdateUser(targetId, BuildUpdateRequest());

        Assert.Equal(StatusCodes.Status403Forbidden, ControllerTestHelpers.StatusCodeOf(response.Result));
        _userService.Verify(
            service => service.UpdateUserAsync(It.IsAny<Guid>(), It.IsAny<UpdateUserRequest>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetUser_GlobalAdminViewingAnyUser_BypassesTenantScope()
    {
        Guid callerId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _userService
            .Setup(service => service.GetUserByIdAsync(targetId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new ApplicationUser { Id = targetId, TenantId = Guid.NewGuid() }));

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId: null, AuthRoles.Administrator);

        ActionResult<ApplicationUser> response = await controller.GetUser(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        _membershipService.Verify(
            service => service.UserBelongsToTenantAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateUser_SelfEdit_Succeeds()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        _userService
            .Setup(service => service.GetUserRolesAsync(callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<IList<string>>([AuthRoles.TenantAdmin]));
        _userService
            .Setup(service => service.UpdateUserAsync(callerId, It.IsAny<UpdateUserRequest>(), callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new ApplicationUser { Id = callerId, TenantId = tenantId }));

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<ApplicationUser> response = await controller.UpdateUser(callerId, BuildUpdateRequest());

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        _membershipService.Verify(
            service => service.UserBelongsToTenantAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private static UpdateUserRequest BuildUpdateRequest()
    {
        return new UpdateUserRequest { FirstName = "Ada", LastName = "Lovelace" };
    }
}
