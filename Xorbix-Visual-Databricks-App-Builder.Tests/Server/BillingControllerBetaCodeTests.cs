using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Tests for the beta code endpoints on <see cref="BillingController"/>, covering the
/// HTTP status mapping of the typed errors returned by <see cref="IBetaCodeService"/>.
/// </summary>
public class BillingControllerBetaCodeTests
{
    private readonly Mock<IBetaCodeService> _betaCodeService = new();

    private BillingController CreateController(Guid userId, Guid tenantId)
    {
        BillingController controller = new BillingController(
            NullLogger<BillingController>.Instance,
            Mock.Of<IBillingService>(),
            Mock.Of<IStripeSubscriptionService>(),
            Mock.Of<IStripePromotionCodeService>(),
            _betaCodeService.Object,
            Mock.Of<ISeatManagementService>(),
            Mock.Of<ISubscriptionHistoryService>(),
            Mock.Of<ISubscriptionTierService>());

        controller.ControllerContext = ControllerTestHelpers.BuildContext(userId, tenantId, AuthRoles.TenantAdmin);
        return controller;
    }

    private static BillingController CreateAnonymousController(Mock<IBetaCodeService> betaCodeService)
    {
        BillingController controller = new BillingController(
            NullLogger<BillingController>.Instance,
            Mock.Of<IBillingService>(),
            Mock.Of<IStripeSubscriptionService>(),
            Mock.Of<IStripePromotionCodeService>(),
            betaCodeService.Object,
            Mock.Of<ISeatManagementService>(),
            Mock.Of<ISubscriptionHistoryService>(),
            Mock.Of<ISubscriptionTierService>());

        controller.ControllerContext = ControllerTestHelpers.BuildContext(Guid.NewGuid(), tenantId: null);
        return controller;
    }

    [Fact]
    public async Task ValidateBetaCodePreview_UnknownCode_ReturnsNotFound()
    {
        _betaCodeService
            .Setup(service => service.ValidatePreviewAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<BetaCodeValidationDto>(new NotFoundError("Beta code is invalid.")));

        BillingController controller = CreateAnonymousController(_betaCodeService);

        ActionResult<BetaCodeValidationDto> response = await controller.ValidateBetaCodePreview(
            new ValidateBetaCodePreviewRequest { Code = "UNKNOWN", Tier = SubscriptionTierNames.Individual });

        Assert.Equal(StatusCodes.Status404NotFound, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task ValidateBetaCodePreview_TierMismatch_ReturnsBadRequest()
    {
        _betaCodeService
            .Setup(service => service.ValidatePreviewAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<BetaCodeValidationDto>(new BadRequestError("Beta code applies to the Individual plan only.")));

        BillingController controller = CreateAnonymousController(_betaCodeService);

        ActionResult<BetaCodeValidationDto> response = await controller.ValidateBetaCodePreview(
            new ValidateBetaCodePreviewRequest { Code = "VDAB-BETA-IND", Tier = SubscriptionTierNames.Team });

        Assert.Equal(StatusCodes.Status400BadRequest, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task ValidateBetaCode_UnknownCode_ReturnsNotFound()
    {
        Guid tenantId = Guid.NewGuid();
        _betaCodeService
            .Setup(service => service.ValidateAsync(tenantId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<BetaCodeValidationDto>(new NotFoundError("Beta code is invalid.")));

        BillingController controller = CreateController(Guid.NewGuid(), tenantId);

        ActionResult<BetaCodeValidationDto> response = await controller.ValidateBetaCode(
            new ValidateBetaCodeRequest { Code = "UNKNOWN" });

        Assert.Equal(StatusCodes.Status404NotFound, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task ValidateBetaCode_InvalidCode_ReturnsBadRequest()
    {
        Guid tenantId = Guid.NewGuid();
        _betaCodeService
            .Setup(service => service.ValidateAsync(tenantId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<BetaCodeValidationDto>(new BadRequestError("Beta code is no longer active.")));

        BillingController controller = CreateController(Guid.NewGuid(), tenantId);

        ActionResult<BetaCodeValidationDto> response = await controller.ValidateBetaCode(
            new ValidateBetaCodeRequest { Code = "INACTIVE" });

        Assert.Equal(StatusCodes.Status400BadRequest, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task CreateBetaSubscription_ExpiredCode_ReturnsGone()
    {
        Guid tenantId = Guid.NewGuid();
        _betaCodeService
            .Setup(service => service.RedeemAndSubscribeAsync(tenantId, It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<SubscriptionDto>(new GoneError("Beta code has expired.")));

        BillingController controller = CreateController(Guid.NewGuid(), tenantId);

        ActionResult<SubscriptionDto> response = await controller.CreateBetaSubscription(
            new RedeemBetaCodeRequest { Code = "EXPIRED" });

        Assert.Equal(StatusCodes.Status410Gone, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task CreateBetaSubscription_AlreadyRedeemed_ReturnsConflict()
    {
        Guid tenantId = Guid.NewGuid();
        _betaCodeService
            .Setup(service => service.RedeemAndSubscribeAsync(tenantId, It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<SubscriptionDto>(new ConflictError("A beta code has already been redeemed for this account.")));

        BillingController controller = CreateController(Guid.NewGuid(), tenantId);

        ActionResult<SubscriptionDto> response = await controller.CreateBetaSubscription(
            new RedeemBetaCodeRequest { Code = "VDAB-BETA-IND" });

        Assert.Equal(StatusCodes.Status409Conflict, ControllerTestHelpers.StatusCodeOf(response.Result));
    }

    [Fact]
    public async Task CreateBetaSubscription_ValidCode_ReturnsOkWithSubscription()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        SubscriptionDto subscription = new SubscriptionDto
        {
            Id = "sub_beta_test",
            Tier = SubscriptionTierNames.Individual,
            Status = "trialing"
        };
        _betaCodeService
            .Setup(service => service.RedeemAndSubscribeAsync(tenantId, userId, "VDAB-BETA-IND", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(subscription));

        BillingController controller = CreateController(userId, tenantId);

        ActionResult<SubscriptionDto> response = await controller.CreateBetaSubscription(
            new RedeemBetaCodeRequest { Code = "VDAB-BETA-IND" });

        OkObjectResult okResult = Assert.IsType<OkObjectResult>(response.Result);
        SubscriptionDto returned = Assert.IsType<SubscriptionDto>(okResult.Value);
        Assert.Equal("trialing", returned.Status);
        Assert.Null(returned.ClientSecret);
    }
}
