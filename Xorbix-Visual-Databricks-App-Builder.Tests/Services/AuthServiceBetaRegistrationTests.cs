using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

public class AuthServiceBetaRegistrationTests
{
    private readonly Mock<IUserProvisioningService> _userProvisioningService = new();
    private readonly Mock<IBetaCodeService> _betaCodeService = new();
    private readonly Mock<IUserTenantMembershipService> _membershipService = new();

    private void SetupHomeMembership(ApplicationUser user, Guid tenantId)
    {
        _membershipService
            .Setup(service => service.GetCurrentTenantAsync(user.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<UserTenantMembership?>(new UserTenantMembership
            {
                UserId = user.Id,
                TenantId = tenantId,
                Role = "Admin",
                Status = MembershipStatus.Active,
                IsDefault = true,
            }));
    }

    [Fact]
    public async Task RegisterBetaAsync_ValidRequest_RedeemsCodeAndReturnsEmail()
    {
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            Email = "beta@example.com",
        };

        BetaRegisterRequest request = new()
        {
            Email = "beta@example.com",
            FirstName = "Beta",
            LastName = "User",
            Tier = SubscriptionTierNames.Individual,
            BetaCode = "VDAB-BETA-IND",
        };

        _betaCodeService
            .Setup(service => service.ValidatePreviewAsync(request.BetaCode, request.Tier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new BetaCodeValidationDto
            {
                IsValid = true,
                Tier = request.Tier,
                Message = "ok",
            }));

        _userProvisioningService
            .Setup(service => service.CreateUserAsync(request, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(user));
        SetupHomeMembership(user, tenantId);

        _betaCodeService
            .Setup(service => service.RedeemAndSubscribeAsync(tenantId, user.Id, request.BetaCode, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new SubscriptionDto
            {
                Id = "sub_beta",
                Tier = request.Tier,
                Status = "trialing",
            }));

        AuthService authService = CreateService();

        Result<string> result = await authService.RegisterBetaAsync(request);

        Assert.True(result.IsSuccess);
        Assert.Equal("beta@example.com", result.Value);
        _betaCodeService.Verify(
            service => service.RedeemAndSubscribeAsync(tenantId, user.Id, request.BetaCode, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RegisterBetaAsync_PreviewFails_DoesNotCreateUser()
    {
        BetaRegisterRequest request = new()
        {
            Email = "beta@example.com",
            FirstName = "Beta",
            LastName = "User",
            Tier = SubscriptionTierNames.Team,
            BetaCode = "INVALID",
        };

        _betaCodeService
            .Setup(service => service.ValidatePreviewAsync(request.BetaCode, request.Tier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<BetaCodeValidationDto>(new NotFoundError("Beta code is invalid.")));

        AuthService authService = CreateService();

        Result<string> result = await authService.RegisterBetaAsync(request);

        Assert.True(result.IsFailed);
        _userProvisioningService.Verify(
            service => service.CreateUserAsync(It.IsAny<CreateUserRequest>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RegisterBetaAsync_RedeemFails_ReturnsFailure()
    {
        Guid tenantId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = Guid.NewGuid(),
            Email = "beta@example.com",
        };

        BetaRegisterRequest request = new()
        {
            Email = "beta@example.com",
            FirstName = "Beta",
            LastName = "User",
            Tier = SubscriptionTierNames.Individual,
            BetaCode = "VDAB-BETA-IND",
        };

        _betaCodeService
            .Setup(service => service.ValidatePreviewAsync(request.BetaCode, request.Tier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new BetaCodeValidationDto { IsValid = true, Tier = request.Tier, Message = "ok" }));

        _userProvisioningService
            .Setup(service => service.CreateUserAsync(request, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(user));
        SetupHomeMembership(user, tenantId);

        _betaCodeService
            .Setup(service => service.RedeemAndSubscribeAsync(tenantId, user.Id, request.BetaCode, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<SubscriptionDto>(new UpstreamDependencyError("Stripe unavailable.")));

        AuthService authService = CreateService();

        Result<string> result = await authService.RegisterBetaAsync(request);

        Assert.True(result.IsFailed);
        Assert.IsType<UpstreamDependencyError>(result.Errors[0]);
    }

    [Fact]
    public async Task RegisterBetaAsync_DuplicateEmail_ReturnsFakeSuccessWithoutRedemption()
    {
        BetaRegisterRequest request = new()
        {
            Email = "beta@example.com",
            FirstName = "Beta",
            LastName = "User",
            Tier = SubscriptionTierNames.Individual,
            BetaCode = "VDAB-BETA-IND",
        };

        _betaCodeService
            .Setup(service => service.ValidatePreviewAsync(request.BetaCode, request.Tier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new BetaCodeValidationDto
            {
                IsValid = true,
                Tier = request.Tier,
                Message = "ok",
            }));

        _userProvisioningService
            .Setup(service => service.CreateUserAsync(request, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<ApplicationUser>(new IdentityDuplicateError("Email already exists.")));

        AuthService authService = CreateService();

        Result<string> result = await authService.RegisterBetaAsync(request);

        Assert.True(result.IsSuccess);
        Assert.Equal("beta@example.com", result.Value);
        _betaCodeService.Verify(
            service => service.RedeemAndSubscribeAsync(
                It.IsAny<Guid>(),
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private AuthService CreateService()
    {
        return new AuthService(
            NullLogger<AuthService>.Instance,
            null!,
            null!,
            Mock.Of<IEmailSenderService>(),
            _membershipService.Object,
            _userProvisioningService.Object,
            _betaCodeService.Object,
            Mock.Of<IVerificationChallengeService>(),
            Mock.Of<IAuthResponseService>(),
            Mock.Of<ISessionTokenSecurityService>(),
            new AccountAccessPolicy(),
            Options.Create(new AuthenticationConfiguration()));
    }
}
