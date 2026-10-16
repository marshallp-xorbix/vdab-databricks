using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class UserServiceAccountSetupStatusTests
{
    private static readonly DateOnly PolicyVersionDate = new(2026, 1, 1);
    private static readonly DateTime ValidPolicyAcceptedOn = new(2026, 1, 2, 12, 0, 0, DateTimeKind.Utc);

    private readonly Mock<UserManager<ApplicationUser>> _userManager = new(
        Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);
    private readonly Mock<IUserTenantMembershipService> _userTenantMembershipService = new();
    private readonly Mock<IBillingService> _billingService = new();
    private readonly Mock<IBetaCodeRepository> _betaCodeRepository = new();

    [Fact]
    public async Task GetAccountSetupStatusAsync_BetaTrialingWithoutCard_SetupComplete()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        SetupUser(userId);
        SetupTenant(userId, tenantId, subscriptionStatus: SubscriptionStatusNames.Trialing);
        SetupPaymentMethods(tenantId, count: 0);
        _betaCodeRepository
            .Setup(repository => repository.HasTenantRedeemedAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(result.Value.IsSetupComplete);
        Assert.Null(result.Value.CurrentStep);
        Assert.False(result.Value.HasPaymentMethod);
        Assert.False(result.Value.IsPaused);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_BetaIncompleteStripeStatusWithRedemption_SetupComplete()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        SetupUser(userId);
        SetupTenant(
            userId,
            tenantId,
            subscriptionStatus: SubscriptionStatusNames.Incomplete,
            stripeSubscriptionId: "sub_beta_incomplete");
        SetupPaymentMethods(tenantId, count: 0);
        _betaCodeRepository
            .Setup(repository => repository.HasTenantRedeemedAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(result.Value.IsSetupComplete);
        Assert.Null(result.Value.CurrentStep);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_TrialingWithoutCardOrBetaRedemption_SetupIncomplete()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        SetupUser(userId);
        SetupTenant(userId, tenantId, subscriptionStatus: SubscriptionStatusNames.Trialing);
        SetupPaymentMethods(tenantId, count: 0);
        _betaCodeRepository
            .Setup(repository => repository.HasTenantRedeemedAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.IsSetupComplete);
        Assert.Equal("payment", result.Value.CurrentStep);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_PausedSubscription_SetupCompleteAndPaused()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        SetupUser(userId);
        SetupTenant(userId, tenantId, subscriptionStatus: SubscriptionStatusNames.Paused);
        SetupPaymentMethods(tenantId, count: 0);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(result.Value.IsSetupComplete);
        Assert.Null(result.Value.CurrentStep);
        Assert.True(result.Value.IsPaused);
        Assert.True(result.Value.RequiresPaymentMethod);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_TrialingWithCard_SetupCompleteWithoutBetaLookup()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        SetupUser(userId);
        SetupTenant(userId, tenantId, subscriptionStatus: SubscriptionStatusNames.Trialing);
        SetupPaymentMethods(tenantId, count: 1);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.IsSetupComplete);
        _betaCodeRepository.Verify(
            repository => repository.HasTenantRedeemedAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_WithJwtTenant_UsesJwtTenantNotDbFallback()
    {
        Guid userId = Guid.NewGuid();
        Guid jwtTenantId = Guid.NewGuid();
        Guid dbFallbackTenantId = Guid.NewGuid();
        SetupUser(userId);
        SetupTenantMembership(userId, jwtTenantId, subscriptionStatus: SubscriptionStatusNames.Trialing);
        SetupPaymentMethods(jwtTenantId, count: 1);

        Tenant otherTenant = new Tenant
        {
            TenantId = dbFallbackTenantId,
            TenantName = "other-tenant",
            DisplayName = "Other",
            SubscriptionTier = SubscriptionTierNames.Individual,
            SubscriptionStatus = SubscriptionStatusNames.Trialing,
            BillingCustomerId = "cus_other",
            IsActive = true
        };

        _userTenantMembershipService
            .Setup(service => service.GetCurrentTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<UserTenantMembership?>(new UserTenantMembership
            {
                UserId = userId,
                TenantId = dbFallbackTenantId,
                Role = "Admin",
                Tenant = otherTenant
            }));

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId, jwtTenantId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.IsSetupComplete);
        _userTenantMembershipService.Verify(
            service => service.GetUserTenantMembershipAsync(userId, jwtTenantId, It.IsAny<CancellationToken>()),
            Times.Once);
        _userTenantMembershipService.Verify(
            service => service.GetCurrentTenantAsync(userId, It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_GuestOnActiveTenant_SetupCompleteWithoutBilling()
    {
        Guid userId = Guid.NewGuid();
        Guid homeTenantId = Guid.NewGuid();
        Guid activeTenantId = Guid.NewGuid();
        SetupUser(userId, homeTenantId: homeTenantId);
        SetupTenantMembership(
            userId,
            activeTenantId,
            subscriptionStatus: SubscriptionStatusNames.Trialing,
            stripeSubscriptionId: null,
            ownerId: Guid.NewGuid());
        SetupPaymentMethods(activeTenantId, count: 0);
        _betaCodeRepository
            .Setup(repository => repository.HasTenantRedeemedAsync(activeTenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId, activeTenantId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(result.Value.IsSetupComplete);
        Assert.Null(result.Value.CurrentStep);
        _billingService.Verify(
            service => service.GetPaymentMethodsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_OwnerWithDifferentHomeTenant_Incomplete_SeesRealBilling()
    {
        Guid userId = Guid.NewGuid();
        Guid homeTenantId = Guid.NewGuid();
        Guid ownedTenantId = Guid.NewGuid();
        SetupUser(userId, homeTenantId: homeTenantId);
        SetupTenantMembership(
            userId,
            ownedTenantId,
            subscriptionStatus: SubscriptionStatusNames.Incomplete,
            stripeSubscriptionId: null,
            ownerId: userId);
        SetupPaymentMethods(ownedTenantId, count: 0);
        _betaCodeRepository
            .Setup(repository => repository.HasTenantRedeemedAsync(ownedTenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId, ownedTenantId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.False(result.Value.IsSetupComplete);
        Assert.Equal("choose-subscription", result.Value.CurrentStep);
        _billingService.Verify(
            service => service.GetPaymentMethodsAsync(ownedTenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_InternalDevTenantOwner_SetupCompleteWithoutBilling()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        SetupUser(userId, homeTenantId: tenantId);
        SetupTenant(
            userId,
            tenantId,
            subscriptionStatus: SubscriptionStatusNames.Incomplete,
            stripeSubscriptionId: null,
            ownerId: userId);

        Mock<IInternalDevTenantService> internalDevTenantService = new();
        internalDevTenantService
            .Setup(service => service.IsInternalDevTenant(tenantId))
            .Returns(true);

        UserService service = CreateService(internalDevTenantService.Object);

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId, tenantId);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.True(result.Value.IsSetupComplete);
        Assert.Null(result.Value.CurrentStep);
        _billingService.Verify(
            service => service.GetPaymentMethodsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_NullPrivacyPolicyVersion_RequiresPrivacyPolicyAcceptance()
    {
        Guid userId = Guid.NewGuid();
        SetupUser(
            userId,
            useDefaultPrivacyConsent: false,
            privacyPolicyVersionDate: null,
            privacyPolicyAcceptedOn: null);
        SetupNoTenant(userId);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.NeedsPolicyAcceptance);
        Assert.True(result.Value.NeedsPrivacyPolicyAcceptance);
        Assert.False(result.Value.IsSetupComplete);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_OutdatedPrivacyPolicyVersion_RequiresPrivacyPolicyAcceptance()
    {
        Guid userId = Guid.NewGuid();
        SetupUser(
            userId,
            useDefaultPrivacyConsent: false,
            privacyPolicyVersionDate: new DateOnly(2016, 3, 16),
            privacyPolicyAcceptedOn: new DateTime(2016, 3, 16, 12, 0, 0, DateTimeKind.Utc));
        SetupNoTenant(userId);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.NeedsPrivacyPolicyAcceptance);
        Assert.True(result.Value.NeedsPolicyAcceptance);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_StalePrivacyPolicyAcceptedOn_RequiresPrivacyPolicyAcceptance()
    {
        Guid userId = Guid.NewGuid();
        SetupUser(
            userId,
            useDefaultPrivacyConsent: false,
            privacyPolicyVersionDate: PolicyVersionDate,
            privacyPolicyAcceptedOn: new DateTime(2016, 3, 16, 12, 0, 0, DateTimeKind.Utc));
        SetupNoTenant(userId);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.NeedsPrivacyPolicyAcceptance);
        Assert.True(result.Value.NeedsPolicyAcceptance);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_ValidPrivacyPolicyConsent_DoesNotRequirePrivacyPolicyAcceptance()
    {
        Guid userId = Guid.NewGuid();
        SetupUser(
            userId,
            useDefaultPrivacyConsent: false,
            privacyPolicyVersionDate: PolicyVersionDate,
            privacyPolicyAcceptedOn: ValidPolicyAcceptedOn);
        SetupNoTenant(userId);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.NeedsPrivacyPolicyAcceptance);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_MissingPrivacyPolicyAcceptedOn_RequiresPrivacyPolicyAcceptance()
    {
        Guid userId = Guid.NewGuid();
        SetupUser(
            userId,
            useDefaultPrivacyConsent: false,
            privacyPolicyVersionDate: PolicyVersionDate,
            privacyPolicyAcceptedOn: null);
        SetupNoTenant(userId);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.NeedsPrivacyPolicyAcceptance);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_NullTermsOfServiceVersion_RequiresTermsOfServiceAcceptance()
    {
        Guid userId = Guid.NewGuid();
        SetupUser(
            userId,
            useDefaultTermsConsent: false,
            termsOfServiceVersionDate: null,
            termsOfServiceAcceptedOn: null);
        SetupNoTenant(userId);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.NeedsTermsOfServiceAcceptance);
        Assert.True(result.Value.NeedsPolicyAcceptance);
    }

    [Fact]
    public async Task GetAccountSetupStatusAsync_StaleTermsOfServiceAcceptedOn_RequiresTermsOfServiceAcceptance()
    {
        Guid userId = Guid.NewGuid();
        SetupUser(
            userId,
            useDefaultTermsConsent: false,
            termsOfServiceVersionDate: PolicyVersionDate,
            termsOfServiceAcceptedOn: new DateTime(2016, 3, 16, 12, 0, 0, DateTimeKind.Utc));
        SetupNoTenant(userId);

        UserService service = CreateService();

        Result<AccountSetupStatusDto> result = await service.GetAccountSetupStatusAsync(userId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.NeedsTermsOfServiceAcceptance);
        Assert.True(result.Value.NeedsPolicyAcceptance);
    }

    private void SetupNoTenant(Guid userId)
    {
        _userTenantMembershipService
            .Setup(service => service.GetCurrentTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<UserTenantMembership?>(null));
    }

    private UserService CreateService(IInternalDevTenantService? internalDevTenantService = null)
    {
        return new UserService(
            NullLogger<UserService>.Instance,
            _userManager.Object,
            new Mock<IUserRepository>().Object,
            new Mock<IRefreshTokenRepository>().Object,
            new Mock<IEmailSenderService>().Object,
            _userTenantMembershipService.Object,
            Mock.Of<ITenantRepository>(),
            Mock.Of<ITenantAccessRevocationService>(),
            _billingService.Object,
            _betaCodeRepository.Object,
            internalDevTenantService ?? Mock.Of<IInternalDevTenantService>(),
            Options.Create(new PolicyConsentConfiguration
            {
                TermsOfServiceVersionDate = PolicyVersionDate,
                PrivacyPolicyVersionDate = PolicyVersionDate
            }),
            Options.Create(new AuthenticationConfiguration()),
            Mock.Of<IAuditLogService>());
    }

    private void SetupUser(
        Guid userId,
        DateOnly? termsOfServiceVersionDate = null,
        DateTime? termsOfServiceAcceptedOn = null,
        DateOnly? privacyPolicyVersionDate = null,
        DateTime? privacyPolicyAcceptedOn = null,
        bool useDefaultTermsConsent = true,
        bool useDefaultPrivacyConsent = true,
        Guid? homeTenantId = null)
    {
        DateOnly? resolvedTermsVersion = useDefaultTermsConsent
            ? PolicyVersionDate
            : termsOfServiceVersionDate;
        DateTime? resolvedTermsAcceptedOn = useDefaultTermsConsent
            ? ValidPolicyAcceptedOn
            : termsOfServiceAcceptedOn;
        DateOnly? resolvedPrivacyVersion = useDefaultPrivacyConsent
            ? PolicyVersionDate
            : privacyPolicyVersionDate;
        DateTime? resolvedPrivacyAcceptedOn = useDefaultPrivacyConsent
            ? ValidPolicyAcceptedOn
            : privacyPolicyAcceptedOn;

        ApplicationUser user = new ApplicationUser
        {
            Id = userId,
            IsActive = true,
            TenantId = homeTenantId,
            TermsOfServiceVersionDate = resolvedTermsVersion,
            TermsOfServiceAcceptedOn = resolvedTermsAcceptedOn,
            PrivacyPolicyVersionDate = resolvedPrivacyVersion,
            PrivacyPolicyAcceptedOn = resolvedPrivacyAcceptedOn
        };

        _userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
        _userManager.Setup(manager => manager.GetRolesAsync(user)).ReturnsAsync([]);
    }

    private void SetupTenant(
        Guid userId,
        Guid tenantId,
        string subscriptionStatus,
        string? stripeSubscriptionId = "sub_test",
        Guid? ownerId = null)
    {
        SetupTenantMembership(userId, tenantId, subscriptionStatus, stripeSubscriptionId, ownerId);

        _userTenantMembershipService
            .Setup(service => service.GetCurrentTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<UserTenantMembership?>(
                BuildMembership(userId, tenantId, subscriptionStatus, stripeSubscriptionId, ownerId)));
    }

    private void SetupTenantMembership(
        Guid userId,
        Guid tenantId,
        string subscriptionStatus,
        string? stripeSubscriptionId = "sub_test",
        Guid? ownerId = null)
    {
        UserTenantMembership membership = BuildMembership(
            userId,
            tenantId,
            subscriptionStatus,
            stripeSubscriptionId,
            ownerId);

        _userTenantMembershipService
            .Setup(service => service.GetUserTenantMembershipAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(membership));
    }

    private static UserTenantMembership BuildMembership(
        Guid userId,
        Guid tenantId,
        string subscriptionStatus,
        string? stripeSubscriptionId = "sub_test",
        Guid? ownerId = null)
    {
        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Individual,
            SubscriptionStatus = subscriptionStatus,
            StripeSubscriptionId = stripeSubscriptionId,
            BillingCustomerId = "cus_test",
            OwnerId = ownerId,
            IsActive = true
        };

        return new UserTenantMembership
        {
            UserId = userId,
            TenantId = tenantId,
            Role = "Admin",
            Tenant = tenant
        };
    }

    private void SetupPaymentMethods(Guid tenantId, int count)
    {
        IList<PaymentMethodDto> paymentMethods = Enumerable.Range(0, count)
            .Select(index => new PaymentMethodDto
            {
                Id = $"pm_test_{index}",
                Brand = "visa",
                Last4 = "4242",
                ExpMonth = 12,
                ExpYear = 2030,
                IsDefault = index == 0
            })
            .ToList();

        _billingService
            .Setup(service => service.GetPaymentMethodsAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(paymentMethods));
    }
}
