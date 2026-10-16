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

public class StripeWebhookBillingNotificationTests
{
    [Fact]
    public async Task HandleWebhookAsync_SendsTrialEndingEmail_WhenTrialWillEndEventReceived()
    {
        const string webhookSecret = "whsec_test_trial_will_end";
        const string eventId = "evt_test_trial_will_end";
        const string customerId = "cus_trial_end";
        const string subscriptionId = "sub_trial_end";

        long trialEndUnix = DateTimeOffset.UtcNow.AddDays(3).ToUnixTimeSeconds();
        string payload = CreateTrialWillEndPayload(eventId, customerId, subscriptionId, trialEndUnix);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, customerId, subscriptionId);

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant);
        Mock<ISubscriptionHistoryRepository> subscriptionHistoryRepository = new Mock<ISubscriptionHistoryRepository>();
        SubscriptionHistory? capturedHistory = null;
        subscriptionHistoryRepository
            .Setup(repository => repository.AddAsync(It.IsAny<SubscriptionHistory>()))
            .Callback<SubscriptionHistory>(history => capturedHistory = history)
            .Returns(Task.CompletedTask);

        Mock<IEmailSenderService> emailSenderService = new Mock<IEmailSenderService>();
        emailSenderService
            .Setup(service => service.SendBillingTrialEndingAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Mock<IUserTenantMembershipRepository> membershipRepository = CreateAdminMembershipRepository(
            tenantId,
            "admin@example.com");

        StripeWebhookService service = CreateService(
            webhookSecret,
            tenantRepository,
            subscriptionHistoryRepository,
            emailSenderService,
            membershipRepository);

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.NotNull(capturedHistory);
        Assert.Equal("TrialEnding", capturedHistory!.EventType);
        emailSenderService.Verify(
            service => service.SendBillingTrialEndingAsync(
                "admin@example.com",
                tenant.DisplayName,
                It.Is<DateTimeOffset?>(trialEnd => trialEnd.HasValue && trialEnd.Value.ToUnixTimeSeconds() == trialEndUnix),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleWebhookAsync_SendsPaymentFailedEmail_WhenInvoicePaymentFailedEventReceived()
    {
        const string webhookSecret = "whsec_test_payment_failed";
        const string eventId = "evt_test_payment_failed";
        const string customerId = "cus_payment_failed";
        const string subscriptionId = "sub_payment_failed";
        const string invoiceId = "in_payment_failed";

        string payload = CreateInvoicePaymentFailedPayload(eventId, customerId, subscriptionId, invoiceId, amountDue: 4900);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, customerId, subscriptionId, subscriptionStatus: "trialing");

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant);
        Tenant? updatedTenant = null;
        tenantRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .Callback<Tenant, CancellationToken>((updated, _) => updatedTenant = updated)
            .Returns(Task.CompletedTask);

        Mock<ISubscriptionHistoryRepository> subscriptionHistoryRepository = new Mock<ISubscriptionHistoryRepository>();
        SubscriptionHistory? capturedHistory = null;
        subscriptionHistoryRepository
            .Setup(repository => repository.AddAsync(It.IsAny<SubscriptionHistory>()))
            .Callback<SubscriptionHistory>(history => capturedHistory = history)
            .Returns(Task.CompletedTask);

        Mock<ISubscriptionSeatRepository> subscriptionSeatRepository = new Mock<ISubscriptionSeatRepository>();
        subscriptionSeatRepository
            .Setup(repository => repository.GetTotalActiveCountAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        Mock<IEmailSenderService> emailSenderService = new Mock<IEmailSenderService>();
        emailSenderService
            .Setup(service => service.SendBillingPaymentFailedAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Mock<IUserTenantMembershipRepository> membershipRepository = CreateAdminMembershipRepository(
            tenantId,
            "admin@example.com");

        StripeWebhookService service = CreateService(
            webhookSecret,
            tenantRepository,
            subscriptionHistoryRepository,
            emailSenderService,
            membershipRepository,
            subscriptionSeatRepository);

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.NotNull(updatedTenant);
        Assert.Equal("past_due", updatedTenant!.SubscriptionStatus);
        Assert.NotNull(capturedHistory);
        Assert.Equal("Payment", capturedHistory!.EventType);
        Assert.Equal("Failed", capturedHistory.PaymentStatus);
        Assert.Equal(invoiceId, capturedHistory.StripeInvoiceId);
        emailSenderService.Verify(
            service => service.SendBillingPaymentFailedAsync(
                "admin@example.com",
                tenant.DisplayName,
                invoiceId,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleWebhookAsync_UsesInvoiceEmailFallback_WhenNoTenantAdminRecipients()
    {
        const string webhookSecret = "whsec_test_invoice_email_fallback";
        const string eventId = "evt_test_invoice_email_fallback";
        const string customerId = "cus_invoice_fallback";
        const string subscriptionId = "sub_invoice_fallback";

        long trialEndUnix = DateTimeOffset.UtcNow.AddDays(3).ToUnixTimeSeconds();
        string payload = CreateTrialWillEndPayload(eventId, customerId, subscriptionId, trialEndUnix);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, customerId, subscriptionId);
        tenant.InvoiceEmail = "billing@example.com";

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant);
        Mock<ISubscriptionHistoryRepository> subscriptionHistoryRepository = new Mock<ISubscriptionHistoryRepository>();
        subscriptionHistoryRepository
            .Setup(repository => repository.AddAsync(It.IsAny<SubscriptionHistory>()))
            .Returns(Task.CompletedTask);

        Mock<IEmailSenderService> emailSenderService = new Mock<IEmailSenderService>();
        emailSenderService
            .Setup(service => service.SendBillingTrialEndingAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<UserTenantMembership>());

        StripeWebhookService service = CreateService(
            webhookSecret,
            tenantRepository,
            subscriptionHistoryRepository,
            emailSenderService,
            membershipRepository);

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        emailSenderService.Verify(
            service => service.SendBillingTrialEndingAsync(
                "billing@example.com",
                tenant.DisplayName,
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleWebhookAsync_DoesNotSendBillingEmail_WhenNoRecipientsAndNoInvoiceEmail()
    {
        const string webhookSecret = "whsec_test_no_recipients";
        const string eventId = "evt_test_no_recipients";
        const string customerId = "cus_no_recipients";
        const string subscriptionId = "sub_no_recipients";

        long trialEndUnix = DateTimeOffset.UtcNow.AddDays(3).ToUnixTimeSeconds();
        string payload = CreateTrialWillEndPayload(eventId, customerId, subscriptionId, trialEndUnix);
        string signature = CreateStripeSignatureHeader(payload, webhookSecret);

        Guid tenantId = Guid.NewGuid();
        Tenant tenant = CreateTenant(tenantId, customerId, subscriptionId);
        tenant.InvoiceEmail = null;

        Mock<ITenantRepository> tenantRepository = CreateTenantRepository(tenant);
        Mock<ISubscriptionHistoryRepository> subscriptionHistoryRepository = new Mock<ISubscriptionHistoryRepository>();
        subscriptionHistoryRepository
            .Setup(repository => repository.AddAsync(It.IsAny<SubscriptionHistory>()))
            .Returns(Task.CompletedTask);

        Mock<IEmailSenderService> emailSenderService = new Mock<IEmailSenderService>();

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.GetByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<UserTenantMembership>());

        StripeWebhookService service = CreateService(
            webhookSecret,
            tenantRepository,
            subscriptionHistoryRepository,
            emailSenderService,
            membershipRepository);

        Result result = await service.HandleWebhookAsync(payload, signature);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        emailSenderService.Verify(
            service => service.SendBillingTrialEndingAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        emailSenderService.Verify(
            service => service.SendBillingPaymentFailedAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private static Tenant CreateTenant(
        Guid tenantId,
        string customerId,
        string subscriptionId,
        string subscriptionStatus = "trialing")
    {
        return new Tenant
        {
            TenantId = tenantId,
            TenantName = "tenant-name",
            DisplayName = "Tenant",
            SubscriptionTier = SubscriptionTierNames.Individual,
            SubscriptionStatus = subscriptionStatus,
            BillingCustomerId = customerId,
            StripeSubscriptionId = subscriptionId,
            IsActive = true
        };
    }

    private static Mock<ITenantRepository> CreateTenantRepository(Tenant tenant)
    {
        Mock<ITenantRepository> tenantRepository = new Mock<ITenantRepository>();
        tenantRepository
            .Setup(repository => repository.GetByStripeSubscriptionIdAsync(tenant.StripeSubscriptionId!))
            .ReturnsAsync(tenant);
        tenantRepository
            .Setup(repository => repository.GetByBillingCustomerIdAsync(tenant.BillingCustomerId!))
            .ReturnsAsync(tenant);
        return tenantRepository;
    }

    private static Mock<IUserTenantMembershipRepository> CreateAdminMembershipRepository(Guid tenantId, string adminEmail)
    {
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
                        Email = adminEmail,
                        IsActive = true,
                        EmailNotificationsEnabled = true
                    }
                }
            });
        return membershipRepository;
    }

    private static StripeWebhookService CreateService(
        string webhookSecret,
        Mock<ITenantRepository> tenantRepository,
        Mock<ISubscriptionHistoryRepository> subscriptionHistoryRepository,
        Mock<IEmailSenderService> emailSenderService,
        Mock<IUserTenantMembershipRepository> membershipRepository,
        Mock<ISubscriptionSeatRepository>? subscriptionSeatRepository = null)
    {
        Mock<IStripeEventLogRepository> stripeEventLogRepository = new Mock<IStripeEventLogRepository>();
        stripeEventLogRepository.Setup(repository => repository.ExistsAsync(It.IsAny<string>())).ReturnsAsync(false);

        StripeWebhookRepositorySet repositorySet = new StripeWebhookRepositorySet(
            stripeEventLogRepository.Object,
            tenantRepository.Object,
            subscriptionHistoryRepository.Object,
            subscriptionSeatRepository?.Object ?? new Mock<ISubscriptionSeatRepository>().Object,
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

    private static string CreateTrialWillEndPayload(
        string eventId,
        string customerId,
        string subscriptionId,
        long trialEndUnix)
    {
        long periodStart = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        long periodEnd = DateTimeOffset.UtcNow.AddDays(30).ToUnixTimeSeconds();

        return $$"""
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
              "status": "trialing",
              "cancel_at_period_end": false,
              "trial_end": {{trialEndUnix}},
              "livemode": false,
              "metadata": {},
              "items": {
                "object": "list",
                "data": [
                  {
                    "id": "si_test_1",
                    "object": "subscription_item",
                    "quantity": 1,
                    "current_period_start": {{periodStart}},
                    "current_period_end": {{periodEnd}},
                    "price": {
                      "id": "price_individual_monthly",
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
          "type": "customer.subscription.trial_will_end"
        }
        """;
    }

    private static string CreateInvoicePaymentFailedPayload(
        string eventId,
        string customerId,
        string subscriptionId,
        string invoiceId,
        long amountDue)
    {
        long created = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        return $$"""
        {
          "id": "{{eventId}}",
          "object": "event",
          "account": "acct_123",
          "api_version": "{{StripeConfiguration.ApiVersion}}",
          "created": {{created}},
          "data": {
            "object": {
              "id": "{{invoiceId}}",
              "object": "invoice",
              "customer": "{{customerId}}",
              "amount_due": {{amountDue}},
              "currency": "usd",
              "billing_reason": "subscription_cycle",
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
          "type": "invoice.payment_failed"
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
