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
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class StripeWebhookPromoEndingTests
{
    [Fact]
    public async Task HandleWebhookAsync_SendsPromoEndingEmail_WhenUpcomingInvoiceHasAmountDueAndPromoAppliedHistory()
    {
        const string webhookSecret = "whsec_test_promo_upcoming";
        const string eventId = "evt_test_promo_upcoming";
        const string customerId = "cus_promo_test";
        const string subscriptionId = "sub_promo_test";

        string payload = CreateInvoiceUpcomingPayload(eventId, customerId, subscriptionId, amountDue: 9900);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Guid tenantId = Guid.NewGuid();
        Tenant tenant = new Tenant
        {
            TenantId = tenantId,
            TenantName = "promo-tenant",
            DisplayName = "Promo Tenant",
            BillingCustomerId = customerId,
            StripeSubscriptionId = subscriptionId,
            SubscriptionTier = SubscriptionTierNames.Team,
            SubscriptionStatus = "active",
            IsActive = true
        };

        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository
            .Setup(repository => repository.GetByStripeSubscriptionIdAsync(subscriptionId))
            .ReturnsAsync(tenant);

        Mock<ISubscriptionHistoryRepository> subscriptionHistoryRepository = new Mock<ISubscriptionHistoryRepository>();
        subscriptionHistoryRepository
            .Setup(repository => repository.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<SubscriptionHistory>
            {
                new SubscriptionHistory
                {
                    TenantId = tenantId,
                    EventType = SubscriptionHistoryEventTypes.PromoApplied,
                    SubscriptionTier = SubscriptionTierNames.Team,
                    BillingCycle = "Monthly"
                }
            });

        Mock<IEmailSenderService> emailSenderService = new Mock<IEmailSenderService>();
        emailSenderService
            .Setup(service => service.SendBillingPromoEndingAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<decimal>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<UserTenantMembership>
            {
                new UserTenantMembership
                {
                    TenantId = tenantId,
                    Role = AuthRoles.TenantAdmin,
                    User = new ApplicationUser
                    {
                        Email = "admin@example.com",
                        IsActive = true,
                        EmailNotificationsEnabled = true
                    }
                }
            });

        StripeWebhookService service = CreateService(
            webhookSecret,
            tenantRepository,
            subscriptionHistoryRepository,
            emailSenderService,
            membershipRepository);

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        emailSenderService.Verify(
            service => service.SendBillingPromoEndingAsync(
                "admin@example.com",
                tenant.DisplayName,
                It.IsAny<DateTimeOffset?>(),
                99m,
                tenant.SubscriptionTier,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static StripeWebhookService CreateService(
        string webhookSecret,
        Mock<ITenantRepository> tenantRepository,
        Mock<ISubscriptionHistoryRepository> subscriptionHistoryRepository,
        Mock<IEmailSenderService> emailSenderService,
        Mock<IUserTenantMembershipRepository> membershipRepository)
    {
        Mock<IStripeEventLogRepository> stripeEventLogRepository = new Mock<IStripeEventLogRepository>();
        stripeEventLogRepository.Setup(repository => repository.ExistsAsync(It.IsAny<string>())).ReturnsAsync(false);

        StripeWebhookRepositorySet repositorySet = new StripeWebhookRepositorySet(
            stripeEventLogRepository.Object,
            tenantRepository.Object,
            subscriptionHistoryRepository.Object,
            new Mock<ISubscriptionSeatRepository>().Object,
            membershipRepository.Object);

        ISubscriptionTierService subscriptionTierService = new Mock<ISubscriptionTierService>().Object;
        ISeatManagementService seatManagementService = new Mock<ISeatManagementService>().Object;
        IStripeSubscriptionService stripeSubscriptionService = new Mock<IStripeSubscriptionService>().Object;
        IOptions<StripeSettings> stripeSettings = Options.Create(new StripeSettings { WebhookSecret = webhookSecret });

        return new StripeWebhookService(
            NullLogger<StripeWebhookService>.Instance,
            repositorySet,
            subscriptionTierService,
            seatManagementService,
            stripeSubscriptionService,
            emailSenderService.Object,
            stripeSettings);
    }

    private static string CreateInvoiceUpcomingPayload(
        string eventId,
        string customerId,
        string subscriptionId,
        long amountDue)
    {
        long created = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        long periodStart = DateTimeOffset.UtcNow.AddDays(3).ToUnixTimeSeconds();

        return $$"""
        {
          "id": "{{eventId}}",
          "object": "event",
          "account": "acct_123",
          "api_version": "{{StripeConfiguration.ApiVersion}}",
          "created": {{created}},
            "data": {
            "object": {
              "id": "in_upcoming_test",
              "object": "invoice",
              "customer": "{{customerId}}",
              "amount_due": {{amountDue}},
              "currency": "usd",
              "period_start": {{periodStart}},
              "parent": {
                "type": "subscription_details",
                "subscription_details": {
                  "subscription": "{{subscriptionId}}"
                }
              }
            }
          },
          "livemode": false,
          "pending_webhooks": 1,
          "request": {
            "id": "req_123",
            "idempotency_key": "idempotency-key-123"
          },
          "type": "invoice.upcoming"
        }
        """;
    }

    private static string CreateStripeSignatureHeader(string payload, string webhookSecret)
    {
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        string signature = EventUtility.ComputeSignature(webhookSecret, timestamp, payload);
        return $"t={timestamp},v1={signature}";
    }
}
