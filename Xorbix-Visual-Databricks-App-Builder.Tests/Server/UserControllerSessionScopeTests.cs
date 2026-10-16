using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Tenant-admin session endpoints are scoped to the caller's tenant (no cross-tenant PII / logout).
/// </summary>
public class UserControllerSessionScopeTests
{
    private readonly Mock<IUserSessionService> _userSessionService = new();
    private readonly Mock<ISessionTokenSecurityService> _sessionTokenSecurity = new();
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();

    private UserController CreateController()
    {
        return new UserController(
            NullLogger<UserController>.Instance,
            Mock.Of<IUserService>(),
            Mock.Of<IUserProvisioningService>(),
            Mock.Of<IUserLifecycleService>(),
            _userSessionService.Object,
            _sessionTokenSecurity.Object,
            _membershipService.Object,
            Mock.Of<IAuthService>());
    }

    [Fact]
    public async Task GetUserSessions_TenantAdmin_PassesCallerTenantFilter()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(s => s.UserBelongsToTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _userSessionService
            .Setup(s => s.GetUserSessionsAsync(
                targetId,
                0,
                25,
                true,
                It.IsAny<Guid?>(),
                tenantId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserSessionsResponse { Sessions = [], TotalCount = 0 }));

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        IActionResult response = await controller.GetUserSessions(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _userSessionService.Verify(
            s => s.GetUserSessionsAsync(
                targetId,
                0,
                25,
                true,
                It.IsAny<Guid?>(),
                tenantId,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ForceLogoutAllDevices_TenantAdmin_UsesTenantScopedLogout()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _membershipService
            .Setup(s => s.UserBelongsToTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _sessionTokenSecurity
            .Setup(s => s.ForceLogoutTenantSessionsAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        IActionResult response = await controller.ForceLogoutAllDevices(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _sessionTokenSecurity.Verify(
            s => s.ForceLogoutTenantSessionsAsync(targetId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
        _sessionTokenSecurity.Verify(
            s => s.ForceLogoutAllDevicesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RevokeSession_TenantAdmin_PassesCallerTenantFilter()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();
        const int sessionTokenId = 42;

        _membershipService
            .Setup(s => s.UserBelongsToTenantAsync(targetId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _userSessionService
            .Setup(s => s.RevokeSessionAsync(
                targetId,
                sessionTokenId,
                callerId,
                It.IsAny<Guid?>(),
                tenantId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new RevokeSessionResponse { RevokedCurrentSession = false }));

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<RevokeSessionResponse> response =
            await controller.RevokeSession(targetId, sessionTokenId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        _userSessionService.Verify(
            s => s.RevokeSessionAsync(
                targetId,
                sessionTokenId,
                callerId,
                It.IsAny<Guid?>(),
                tenantId,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ForceLogoutAllDevices_Self_UsesAccountWideLogout_EvenWithTenantClaim()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        _sessionTokenSecurity
            .Setup(s => s.ForceLogoutAllDevicesAsync(callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        IActionResult response = await controller.ForceLogoutAllDevices(callerId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _sessionTokenSecurity.Verify(
            s => s.ForceLogoutAllDevicesAsync(callerId, It.IsAny<CancellationToken>()),
            Times.Once);
        _sessionTokenSecurity.Verify(
            s => s.ForceLogoutTenantSessionsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ForceLogoutAllDevices_GlobalAdminWithTenantClaim_UsesAccountWideLogout()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _sessionTokenSecurity
            .Setup(s => s.ForceLogoutAllDevicesAsync(targetId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.Administrator);

        IActionResult response = await controller.ForceLogoutAllDevices(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _sessionTokenSecurity.Verify(
            s => s.ForceLogoutAllDevicesAsync(targetId, It.IsAny<CancellationToken>()),
            Times.Once);
        _sessionTokenSecurity.Verify(
            s => s.ForceLogoutTenantSessionsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetUserSessions_Self_PassesNullTenantFilter()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        _userSessionService
            .Setup(s => s.GetUserSessionsAsync(
                callerId,
                0,
                25,
                true,
                It.IsAny<Guid?>(),
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserSessionsResponse { Sessions = [], TotalCount = 0 }));

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        IActionResult response = await controller.GetUserSessions(callerId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _userSessionService.Verify(
            s => s.GetUserSessionsAsync(
                callerId,
                0,
                25,
                true,
                It.IsAny<Guid?>(),
                null,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task GetUserSessions_GlobalAdminWithTenantClaim_PassesNullTenantFilter()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid targetId = Guid.NewGuid();

        _userSessionService
            .Setup(s => s.GetUserSessionsAsync(
                targetId,
                0,
                25,
                true,
                It.IsAny<Guid?>(),
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new UserSessionsResponse { Sessions = [], TotalCount = 0 }));

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.Administrator);

        IActionResult response = await controller.GetUserSessions(targetId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response as ActionResult));
        _userSessionService.Verify(
            s => s.GetUserSessionsAsync(
                targetId,
                0,
                25,
                true,
                It.IsAny<Guid?>(),
                null,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RevokeSession_Self_PassesNullTenantFilter()
    {
        Guid callerId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        const int sessionTokenId = 42;

        _userSessionService
            .Setup(s => s.RevokeSessionAsync(
                callerId,
                sessionTokenId,
                callerId,
                It.IsAny<Guid?>(),
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new RevokeSessionResponse { RevokedCurrentSession = false }));

        UserController controller = CreateController();
        controller.ControllerContext = ControllerTestHelpers.BuildContext(callerId, tenantId, AuthRoles.TenantAdmin);

        ActionResult<RevokeSessionResponse> response =
            await controller.RevokeSession(callerId, sessionTokenId);

        Assert.Equal(StatusCodes.Status200OK, ControllerTestHelpers.StatusCodeOf(response.Result));
        _userSessionService.Verify(
            s => s.RevokeSessionAsync(
                callerId,
                sessionTokenId,
                callerId,
                It.IsAny<Guid?>(),
                null,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
