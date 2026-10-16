using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Stripe;
using System.Globalization;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class StripeWebhookServiceTests
{
    [Fact]
    public async Task ValidateSignatureAsync_ReturnsEvent_WhenSignatureIsValid()
    {
        const string webhookSecret = "whsec_test_valid";
        const string eventId = "evt_test_valid";

        string payload = CreateCustomerUpdatedEventPayload(eventId);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        StripeWebhookService service = CreateService(webhookSecret);

        Result<Event> result = service.ValidateSignatureAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.Equal(eventId, result.Value.Id);
        Assert.Equal(EventTypes.CustomerUpdated, result.Value.Type);
    }

    [Fact]
    public async Task ValidateSignatureAsync_Fails_WhenSignatureIsInvalid()
    {
        const string webhookSecret = "whsec_test_invalid";

        string payload = CreateCustomerUpdatedEventPayload("evt_test_invalid");
        string signatureWithDifferentSecret = CreateStripeSignatureHeader(payload, "whsec_other_secret");

        StripeWebhookService service = CreateService(webhookSecret);

        Result<Event> result = service.ValidateSignatureAsync(payload, signatureWithDifferentSecret);

        Assert.True(result.IsFailed);
        Assert.IsType<UnauthorizedError>(result.Errors[0]);
    }

    [Fact]
    public async Task HandleWebhookAsync_ReturnsSuccess_WhenEventAlreadyProcessed()
    {
        const string webhookSecret = "whsec_test_processed";
        const string eventId = "evt_test_processed";

        string payload = CreateCustomerUpdatedEventPayload(eventId);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Mock<IStripeEventLogRepository> stripeEventLogRepository = new Mock<IStripeEventLogRepository>();
        stripeEventLogRepository.Setup(repository => repository.ExistsAsync(eventId)).ReturnsAsync(true);

        StripeWebhookService service = CreateService(webhookSecret, stripeEventLogRepository);

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        stripeEventLogRepository.Verify(repository => repository.ExistsAsync(eventId), Times.Once);
        stripeEventLogRepository.Verify(repository => repository.AddAsync(It.IsAny<StripeEventLog>()), Times.Never);
    }

    [Fact]
    public async Task HandleSubscriptionUpdatedAsync_RecomputesPerSeatLimitsForTeamTenant()
    {
        const string webhookSecret = "whsec_test_limits";
        const string eventId = "evt_test_limits";
        const string subscriptionId = "sub_test_limits";
        const string customerId = "cus_test_limits";
        const string teamPriceId = "price_team_monthly";
        const int quantity = 4;

        Guid tenantId = Guid.NewGuid();
        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Team,
            SubscriptionStatus = SubscriptionStatusNames.Active,
            BillingCustomerId = customerId,
            StripeSubscriptionId = subscriptionId,
            IsActive = true
        };

        string payload = CreateSubscriptionUpdatedEventPayload(eventId, subscriptionId, customerId, teamPriceId, quantity, SubscriptionStatusNames.Active);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Mock<IStripeEventLogRepository> stripeEventLogRepository = new Mock<IStripeEventLogRepository>();
        stripeEventLogRepository.Setup(repository => repository.ExistsAsync(eventId)).ReturnsAsync(false);

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByStripeSubscriptionIdAsync(subscriptionId)).ReturnsAsync(tenant);

        Tenant? updatedTenant = null;
        tenantRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .Callback<Tenant, CancellationToken>((updated, _) => updatedTenant = updated)
            .Returns(Task.CompletedTask);

        Mock<ISubscriptionSeatRepository> subscriptionSeatRepository = new Mock<ISubscriptionSeatRepository>();
        // Existing seats already match the target quantity so reconciliation is a no-op.
        List<SubscriptionSeat> existingSeats = Enumerable.Range(0, quantity)
            .Select(_ => new SubscriptionSeat
            {
                TenantId = tenantId,
                Status = "Active",
                IsBundled = false,
                SeatStartDate = DateTimeOffset.UtcNow
            })
            .ToList();
        subscriptionSeatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingSeats);
        subscriptionSeatRepository
            .Setup(repository => repository.GetTotalActiveCountAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(quantity);

        StripeWebhookRepositorySet repositorySet = new StripeWebhookRepositorySet(
            stripeEventLogRepository.Object,
            tenantRepository.Object,
            new Mock<ISubscriptionHistoryRepository>().Object,
            subscriptionSeatRepository.Object,
            new Mock<IUserTenantMembershipRepository>().Object);

        StripeWebhookService service = new StripeWebhookService(
            NullLogger<StripeWebhookService>.Instance,
            repositorySet,
            CreateRealTierService(),
            new Mock<ISeatManagementService>().Object,
            new Mock<IStripeSubscriptionService>().Object,
            new Mock<IEmailSenderService>().Object,
            Options.Create(new StripeSettings { WebhookSecret = webhookSecret }));

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.NotNull(updatedTenant);
        Assert.Equal(quantity, updatedTenant!.MaxUsers);
        Assert.Equal(80, updatedTenant.MaxPublishedApps);
        Assert.Equal(12, updatedTenant.MaxWorkspaceConnections);
    }

    [Fact]
    public async Task HandleSubscriptionUpdatedAsync_SyncsTrialEndDateAndTrialLimitsForTrialingTenant()
    {
        const string webhookSecret = "whsec_test_trial";
        const string eventId = "evt_test_trial";
        const string subscriptionId = "sub_test_trial";
        const string customerId = "cus_test_trial";
        const string teamPriceId = "price_team_monthly";
        const int quantity = 3;

        long trialEndUnix = DateTimeOffset.UtcNow.AddDays(14).ToUnixTimeSeconds();

        Guid tenantId = Guid.NewGuid();
        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Team,
            SubscriptionStatus = "trialing",
            BillingCustomerId = customerId,
            StripeSubscriptionId = subscriptionId,
            IsActive = true
        };

        string payload = CreateSubscriptionUpdatedEventPayload(eventId, subscriptionId, customerId, teamPriceId, quantity, "trialing", trialEndUnix);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Mock<IStripeEventLogRepository> stripeEventLogRepository = new Mock<IStripeEventLogRepository>();
        stripeEventLogRepository.Setup(repository => repository.ExistsAsync(eventId)).ReturnsAsync(false);

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByStripeSubscriptionIdAsync(subscriptionId)).ReturnsAsync(tenant);

        Tenant? updatedTenant = null;
        tenantRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .Callback<Tenant, CancellationToken>((updated, _) => updatedTenant = updated)
            .Returns(Task.CompletedTask);

        Mock<ISubscriptionSeatRepository> subscriptionSeatRepository = new Mock<ISubscriptionSeatRepository>();
        List<SubscriptionSeat> existingSeats = Enumerable.Range(0, quantity)
            .Select(_ => new SubscriptionSeat
            {
                TenantId = tenantId,
                Status = "Active",
                IsBundled = true,
                SeatStartDate = DateTimeOffset.UtcNow
            })
            .ToList();
        subscriptionSeatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingSeats);
        subscriptionSeatRepository
            .Setup(repository => repository.GetTotalActiveCountAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(quantity);

        StripeWebhookRepositorySet repositorySet = new StripeWebhookRepositorySet(
            stripeEventLogRepository.Object,
            tenantRepository.Object,
            new Mock<ISubscriptionHistoryRepository>().Object,
            subscriptionSeatRepository.Object,
            new Mock<IUserTenantMembershipRepository>().Object);

        StripeWebhookService service = new StripeWebhookService(
            NullLogger<StripeWebhookService>.Instance,
            repositorySet,
            CreateRealTierService(),
            new Mock<ISeatManagementService>().Object,
            new Mock<IStripeSubscriptionService>().Object,
            new Mock<IEmailSenderService>().Object,
            Options.Create(new StripeSettings { WebhookSecret = webhookSecret }));

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.NotNull(updatedTenant);
        Assert.Equal("trialing", updatedTenant!.SubscriptionStatus);
        Assert.NotNull(updatedTenant.TrialEndDate);
        Assert.Equal(trialEndUnix, updatedTenant.TrialEndDate!.Value.ToUnixTimeSeconds());
        // Trialing Team uses flat trial limits (3 apps / 3 ws), not per-seat scaling.
        Assert.Equal(3, updatedTenant.MaxPublishedApps);
        Assert.Equal(3, updatedTenant.MaxWorkspaceConnections);
    }

    [Theory]
    [InlineData("customer.subscription.paused", "paused", "Paused")]
    [InlineData("customer.subscription.resumed", "active", "Resumed")]
    public async Task HandleWebhook_PausedOrResumedEvent_SyncsStatusAndRecordsHistory(
        string eventType,
        string subscriptionStatus,
        string expectedHistoryEventType)
    {
        string webhookSecret = $"whsec_test_{expectedHistoryEventType}";
        string eventId = $"evt_test_{expectedHistoryEventType}";
        string subscriptionId = $"sub_test_{expectedHistoryEventType}";
        string customerId = $"cus_test_{expectedHistoryEventType}";
        const string individualPriceId = "price_individual_monthly";

        Guid tenantId = Guid.NewGuid();
        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Individual,
            SubscriptionStatus = "trialing",
            BillingCustomerId = customerId,
            StripeSubscriptionId = subscriptionId,
            IsActive = true
        };

        string payload = CreateSubscriptionUpdatedEventPayload(eventId, subscriptionId, customerId, individualPriceId, 1, subscriptionStatus, eventType: eventType);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Mock<IStripeEventLogRepository> stripeEventLogRepository = new Mock<IStripeEventLogRepository>();
        stripeEventLogRepository.Setup(repository => repository.ExistsAsync(eventId)).ReturnsAsync(false);

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository.Setup(repository => repository.GetByStripeSubscriptionIdAsync(subscriptionId)).ReturnsAsync(tenant);

        Tenant? updatedTenant = null;
        tenantRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .Callback<Tenant, CancellationToken>((updated, _) => updatedTenant = updated)
            .Returns(Task.CompletedTask);

        Mock<ISubscriptionSeatRepository> subscriptionSeatRepository = new Mock<ISubscriptionSeatRepository>();
        List<SubscriptionSeat> existingSeats =
        [
            new SubscriptionSeat
            {
                TenantId = tenantId,
                Status = "Active",
                IsBundled = false,
                SeatStartDate = DateTimeOffset.UtcNow
            }
        ];
        subscriptionSeatRepository
            .Setup(repository => repository.GetByTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingSeats);
        subscriptionSeatRepository
            .Setup(repository => repository.GetTotalActiveCountAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        SubscriptionHistory? recordedHistory = null;
        Mock<ISubscriptionHistoryRepository> subscriptionHistoryRepository = new Mock<ISubscriptionHistoryRepository>();
        subscriptionHistoryRepository
            .Setup(repository => repository.AddAsync(It.IsAny<SubscriptionHistory>()))
            .Callback<SubscriptionHistory>(history => recordedHistory = history)
            .Returns(Task.CompletedTask);

        StripeWebhookRepositorySet repositorySet = new StripeWebhookRepositorySet(
            stripeEventLogRepository.Object,
            tenantRepository.Object,
            subscriptionHistoryRepository.Object,
            subscriptionSeatRepository.Object,
            new Mock<IUserTenantMembershipRepository>().Object);

        StripeWebhookService service = new StripeWebhookService(
            NullLogger<StripeWebhookService>.Instance,
            repositorySet,
            CreateRealTierService(),
            new Mock<ISeatManagementService>().Object,
            new Mock<IStripeSubscriptionService>().Object,
            new Mock<IEmailSenderService>().Object,
            Options.Create(new StripeSettings { WebhookSecret = webhookSecret }));

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.NotNull(updatedTenant);
        Assert.Equal(subscriptionStatus, updatedTenant!.SubscriptionStatus);
        Assert.NotNull(recordedHistory);
        Assert.Equal(expectedHistoryEventType, recordedHistory!.EventType);
        Assert.Equal(tenantId, recordedHistory.TenantId);
    }

    private static SubscriptionTierService CreateRealTierService()
    {
        SubscriptionTierSettings tierSettings = new SubscriptionTierSettings
        {
            Individual = new SubscriptionTierLimits
            {
                MinimumSeats = 1,
                ScalesPerSeat = false,
                MaxPublishedApps = 10,
                MaxWorkspaceConnections = 2
            },
            Team = new SubscriptionTierLimits
            {
                MinimumSeats = 3,
                ScalesPerSeat = true,
                PublishedAppsPerSeat = 20,
                WorkspaceConnectionsPerSeat = 3,
                Trial = new TrialLimits
                {
                    Enabled = true,
                    PeriodDays = 14,
                    Seats = 3,
                    MaxPublishedApps = 3,
                    MaxWorkspaceConnections = 3
                }
            },
            Enterprise = new SubscriptionTierLimits
            {
                MinimumSeats = 0,
                ScalesPerSeat = false,
                MaxPublishedApps = 0,
                MaxWorkspaceConnections = 0
            }
        };

        StripeSettings stripeSettings = new StripeSettings
        {
            SecretKey = "sk_test_123",
            WebhookSecret = "whsec_123",
            PublishableKey = "pk_test_123",
            PriceIds = new StripePriceIds
            {
                Individual = new TierPriceConfig { Monthly = "price_individual_monthly", Yearly = "price_individual_yearly" },
                Team = new TierPriceConfig { Monthly = "price_team_monthly", Yearly = "price_team_yearly" },
                Enterprise = new TierPriceConfig { Monthly = "", Yearly = "" }
            }
        };

        return new SubscriptionTierService(
            Options.Create(tierSettings),
            Options.Create(stripeSettings),
            NullLogger<SubscriptionTierService>.Instance);
    }

    private static StripeWebhookService CreateService(string webhookSecret, Mock<IStripeEventLogRepository>? stripeEventLogRepository = null)
    {
        Mock<IStripeEventLogRepository> stripeEventLogRepositoryMock = stripeEventLogRepository ?? new Mock<IStripeEventLogRepository>();
        if (stripeEventLogRepository == null)
        {
            stripeEventLogRepositoryMock.Setup(repository => repository.ExistsAsync(It.IsAny<string>())).ReturnsAsync(false);
        }

        ITenantRepository tenantRepository = new Mock<ITenantRepository>().Object;
        ISubscriptionHistoryRepository subscriptionHistoryRepository = new Mock<ISubscriptionHistoryRepository>().Object;
        ISubscriptionSeatRepository subscriptionSeatRepository = new Mock<ISubscriptionSeatRepository>().Object;
        IUserTenantMembershipRepository userTenantMembershipRepository = new Mock<IUserTenantMembershipRepository>().Object;

        StripeWebhookRepositorySet repositorySet = new StripeWebhookRepositorySet(
            stripeEventLogRepositoryMock.Object,
            tenantRepository,
            subscriptionHistoryRepository,
            subscriptionSeatRepository,
            userTenantMembershipRepository);

        ISubscriptionTierService subscriptionTierService = new Mock<ISubscriptionTierService>().Object;
        ISeatManagementService seatManagementService = new Mock<ISeatManagementService>().Object;
        IStripeSubscriptionService stripeSubscriptionService = new Mock<IStripeSubscriptionService>().Object;
        IEmailSenderService emailSenderService = new Mock<IEmailSenderService>().Object;

        IOptions<StripeSettings> stripeSettings = Options.Create(new StripeSettings
        {
            WebhookSecret = webhookSecret
        });

        return new StripeWebhookService(
            NullLogger<StripeWebhookService>.Instance,
            repositorySet,
            subscriptionTierService,
            seatManagementService,
            stripeSubscriptionService,
            emailSenderService,
            stripeSettings);
    }

    private static string CreateCustomerUpdatedEventPayload(string eventId)
    {
        string payload = $$"""
{
    "id": "{{eventId}}",
    "object": "event",
    "account": "acct_123",
    "api_version": "{{StripeConfiguration.ApiVersion}}",
    "created": 1533204620,
    "data": {
        "object": {
            "id": "cus_123",
            "object": "customer",
            "created": 123456789,
            "email": "test@stripe.com",
            "livemode": false,
            "metadata": {}
        }
    },
    "livemode": false,
    "pending_webhooks": 1,
    "request": {
        "id": "req_123",
        "idempotency_key": "idempotency-key-123"
    },
    "type": "customer.updated"
}
""";

        return payload;
    }

    private static string CreateStripeSignatureHeader(string payload, string webhookSecret)
    {
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        string signature = EventUtility.ComputeSignature(webhookSecret, timestamp, payload);
        return $"t={timestamp},v1={signature}";
    }

    private static string CreateSubscriptionUpdatedEventPayload(
        string eventId,
        string subscriptionId,
        string customerId,
        string priceId,
        int quantity,
        string status,
        long? trialEndUnix = null,
        string eventType = "customer.subscription.updated")
    {
        long periodStart = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        long periodEnd = DateTimeOffset.UtcNow.AddDays(30).ToUnixTimeSeconds();
        string trialEndJson = trialEndUnix.HasValue ? trialEndUnix.Value.ToString() : "null";

        string payload = $$"""
{
    "id": "{{eventId}}",
    "object": "event",
    "account": "acct_123",
    "api_version": "{{StripeConfiguration.ApiVersion}}",
    "created": 1533204620,
    "data": {
        "object": {
            "id": "{{subscriptionId}}",
            "object": "subscription",
            "customer": "{{customerId}}",
            "status": "{{status}}",
            "cancel_at_period_end": false,
            "trial_end": {{trialEndJson}},
            "livemode": false,
            "metadata": {},
            "items": {
                "object": "list",
                "data": [
                    {
                        "id": "si_test_1",
                        "object": "subscription_item",
                        "quantity": {{quantity}},
                        "current_period_start": {{periodStart}},
                        "current_period_end": {{periodEnd}},
                        "price": {
                            "id": "{{priceId}}",
                            "object": "price",
                            "active": true,
                            "currency": "usd"
                        }
                    }
                ]
            }
        }
    },
    "livemode": false,
    "pending_webhooks": 1,
    "request": {
        "id": "req_123",
        "idempotency_key": "idempotency-key-123"
    },
    "type": "{{eventType}}"
}
""";

        return payload;
    }
}