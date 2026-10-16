using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class BetaCodeServiceTests
{
    private const string ValidCode = "VDAB-BETA-TEST";

    private readonly Mock<IBetaCodeRepository> _betaCodeRepository = new();
    private readonly Mock<ITenantRepository> _tenantRepository = new();
    private readonly Mock<IStripeSubscriptionService> _stripeSubscriptionService = new();

    [Fact]
    public async Task ValidateAsync_ValidCode_ReturnsValidationPreview()
    {
        Guid tenantId = Guid.NewGuid();
        SetupEligibleTenant(tenantId);
        SetupBetaCode(CreateBetaCode());

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(result.Value.IsValid);
        Assert.Equal(SubscriptionTierNames.Individual, result.Value.Tier);
        Assert.Equal(60, result.Value.TrialPeriodDays);
        Assert.NotNull(result.Value.TrialEndDate);
    }

    [Fact]
    public async Task ValidateAsync_LowercaseInput_NormalizesCodeForLookup()
    {
        Guid tenantId = Guid.NewGuid();
        SetupEligibleTenant(tenantId);
        SetupBetaCode(CreateBetaCode());

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, "  vdab-beta-test ");

        Assert.True(result.IsSuccess);
        _betaCodeRepository.Verify(repository => repository.GetByCodeAsync(ValidCode, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ValidateAsync_UnknownCode_ReturnsNotFound()
    {
        Guid tenantId = Guid.NewGuid();
        _betaCodeRepository
            .Setup(repository => repository.GetByCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((BetaCode?)null);

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, "UNKNOWN");

        Assert.True(result.IsFailed);
        Assert.IsType<NotFoundError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_EmptyCode_ReturnsBadRequest()
    {
        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(Guid.NewGuid(), "   ");

        Assert.True(result.IsFailed);
        Assert.IsType<BadRequestError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidatePreviewAsync_ValidCode_ReturnsValidationPreviewWithoutTenant()
    {
        SetupBetaCode(CreateBetaCode());

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidatePreviewAsync(ValidCode);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(result.Value.IsValid);
        Assert.Equal(SubscriptionTierNames.Individual, result.Value.Tier);
        _tenantRepository.Verify(
            repository => repository.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidatePreviewAsync_TierMismatch_ReturnsBetaCodeInvalid()
    {
        SetupBetaCode(CreateBetaCode());

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidatePreviewAsync(
            ValidCode,
            SubscriptionTierNames.Team);

        Assert.True(result.IsFailed);
        Assert.IsType<BadRequestError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidatePreviewAsync_MatchingTier_ReturnsValidationPreview()
    {
        SetupBetaCode(CreateBetaCode());

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidatePreviewAsync(
            ValidCode,
            SubscriptionTierNames.Individual);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task ValidateAsync_InactiveCode_ReturnsBetaCodeInvalid()
    {
        Guid tenantId = Guid.NewGuid();
        BetaCode betaCode = CreateBetaCode();
        betaCode.IsActive = false;
        SetupBetaCode(betaCode);

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<BadRequestError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_ExpiredCode_ReturnsGone()
    {
        Guid tenantId = Guid.NewGuid();
        BetaCode betaCode = CreateBetaCode();
        betaCode.ExpiresOn = DateTimeOffset.UtcNow.AddDays(-1);
        SetupBetaCode(betaCode);

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<GoneError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_TrialEndDateInPast_ReturnsGone()
    {
        Guid tenantId = Guid.NewGuid();
        BetaCode betaCode = CreateBetaCode();
        betaCode.TrialEndDate = DateTimeOffset.UtcNow.AddDays(-1);
        SetupBetaCode(betaCode);

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<GoneError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_MaxRedemptionsReached_ReturnsConflict()
    {
        Guid tenantId = Guid.NewGuid();
        BetaCode betaCode = CreateBetaCode();
        betaCode.MaxRedemptions = 5;
        betaCode.RedemptionCount = 5;
        SetupBetaCode(betaCode);

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<ConflictError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_EnterpriseTierCode_ReturnsBetaCodeInvalid()
    {
        Guid tenantId = Guid.NewGuid();
        BetaCode betaCode = CreateBetaCode();
        betaCode.Tier = SubscriptionTierNames.Enterprise;
        SetupBetaCode(betaCode);

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<BadRequestError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_NoTrialLengthDefined_ReturnsBetaCodeInvalid()
    {
        Guid tenantId = Guid.NewGuid();
        BetaCode betaCode = CreateBetaCode();
        betaCode.TrialPeriodDays = null;
        betaCode.TrialEndDate = null;
        SetupBetaCode(betaCode);

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<BadRequestError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_TenantAlreadyRedeemed_ReturnsConflict()
    {
        Guid tenantId = Guid.NewGuid();
        SetupEligibleTenant(tenantId);
        SetupBetaCode(CreateBetaCode());
        _betaCodeRepository
            .Setup(repository => repository.HasTenantRedeemedAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<ConflictError>(result.Errors[0]);
    }

    [Fact]
    public async Task ValidateAsync_TenantHasActiveSubscription_ReturnsConflict()
    {
        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId);
        tenant.StripeSubscriptionId = "sub_existing";
        tenant.SubscriptionStatus = SubscriptionStatusNames.Active;
        _tenantRepository.Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>())).ReturnsAsync(tenant);
        SetupBetaCode(CreateBetaCode());

        BetaCodeService service = CreateService();

        Result<BetaCodeValidationDto> result = await service.ValidateAsync(tenantId, ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<ConflictError>(result.Errors[0]);
    }

    [Fact]
    public async Task RedeemAndSubscribeAsync_ValidCode_RecordsRedemptionAndCreatesSubscription()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        SetupEligibleTenant(tenantId);
        BetaCode betaCode = CreateBetaCode();
        SetupBetaCode(betaCode);
        _betaCodeRepository
            .Setup(repository => repository.TryIncrementRedemptionAsync(betaCode.BetaCodeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _stripeSubscriptionService
            .Setup(service => service.CreateBetaTrialSubscriptionAsync(tenantId, It.IsAny<BetaCodeRedemptionContext>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(CreateSubscriptionDto()));

        BetaCodeService service = CreateService();

        Result<SubscriptionDto> result = await service.RedeemAndSubscribeAsync(tenantId, userId, ValidCode);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.Equal(SubscriptionStatusNames.Trialing, result.Value.Status);
        _betaCodeRepository.Verify(repository => repository.AddRedemptionAsync(
            It.Is<BetaCodeRedemption>(redemption => redemption.TenantId == tenantId && redemption.UserId == userId),
            It.IsAny<CancellationToken>()), Times.Once);
        _betaCodeRepository.Verify(repository => repository.ReleaseRedemptionAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RedeemAndSubscribeAsync_ConcurrentRedemptionExhaustsCode_ReturnsConflict()
    {
        Guid tenantId = Guid.NewGuid();
        SetupEligibleTenant(tenantId);
        BetaCode betaCode = CreateBetaCode();
        SetupBetaCode(betaCode);
        // The atomic increment loses the race: the code was exhausted between validation and redemption.
        _betaCodeRepository
            .Setup(repository => repository.TryIncrementRedemptionAsync(betaCode.BetaCodeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        BetaCodeService service = CreateService();

        Result<SubscriptionDto> result = await service.RedeemAndSubscribeAsync(tenantId, Guid.NewGuid(), ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<ConflictError>(result.Errors[0]);
        _betaCodeRepository.Verify(repository => repository.AddRedemptionAsync(It.IsAny<BetaCodeRedemption>(), It.IsAny<CancellationToken>()), Times.Never);
        _stripeSubscriptionService.Verify(service => service.CreateBetaTrialSubscriptionAsync(
            It.IsAny<Guid>(), It.IsAny<BetaCodeRedemptionContext>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RedeemAndSubscribeAsync_SubscriptionCreationFails_ReleasesReservation()
    {
        Guid tenantId = Guid.NewGuid();
        SetupEligibleTenant(tenantId);
        BetaCode betaCode = CreateBetaCode();
        SetupBetaCode(betaCode);
        _betaCodeRepository
            .Setup(repository => repository.TryIncrementRedemptionAsync(betaCode.BetaCodeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _stripeSubscriptionService
            .Setup(service => service.CreateBetaTrialSubscriptionAsync(tenantId, It.IsAny<BetaCodeRedemptionContext>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<SubscriptionDto>(new UpstreamDependencyError("Stripe unavailable.")));

        BetaCodeService service = CreateService();

        Result<SubscriptionDto> result = await service.RedeemAndSubscribeAsync(tenantId, Guid.NewGuid(), ValidCode);

        Assert.True(result.IsFailed);
        Assert.IsType<UpstreamDependencyError>(result.Errors[0]);
        _betaCodeRepository.Verify(repository => repository.ReleaseRedemptionAsync(betaCode.BetaCodeId, It.IsAny<CancellationToken>()), Times.Once);
        _betaCodeRepository.Verify(repository => repository.AddRedemptionAsync(It.IsAny<BetaCodeRedemption>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private BetaCodeService CreateService()
    {
        return new BetaCodeService(
            NullLogger<BetaCodeService>.Instance,
            _betaCodeRepository.Object,
            _tenantRepository.Object,
            _stripeSubscriptionService.Object);
    }

    private void SetupBetaCode(BetaCode betaCode)
    {
        _betaCodeRepository
            .Setup(repository => repository.GetByCodeAsync(betaCode.Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync(betaCode);
    }

    private void SetupEligibleTenant(Guid tenantId)
    {
        _tenantRepository
            .Setup(repository => repository.GetByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateTenant(tenantId));
        _betaCodeRepository
            .Setup(repository => repository.HasTenantRedeemedAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
    }

    private static BetaCode CreateBetaCode()
    {
        return new BetaCode
        {
            BetaCodeId = Guid.NewGuid(),
            Code = ValidCode,
            Tier = SubscriptionTierNames.Individual,
            BillingInterval = nameof(BillingInterval.Monthly),
            TrialPeriodDays = 60,
            MaxRedemptions = 100,
            RedemptionCount = 0,
            IsActive = true
        };
    }

    private static Tenant CreateTenant(Guid tenantId)
    {
        return new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Individual,
            IsActive = true
        };
    }

    private static SubscriptionDto CreateSubscriptionDto()
    {
        return new SubscriptionDto
        {
            Id = "sub_beta_test",
            Tier = SubscriptionTierNames.Individual,
            Status = SubscriptionStatusNames.Trialing
        };
    }
}
