using Xorbix_Visual_Databricks_App_Builder.DataAccess;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Groups repositories needed by <see cref="StripeWebhookService"/> to keep constructor dependency count manageable.
/// </summary>
public sealed class StripeWebhookRepositorySet
{
    /// <summary>
    /// Initializes a new instance of the <see cref="StripeWebhookRepositorySet"/> class.
    /// </summary>
    public StripeWebhookRepositorySet(
        IStripeEventLogRepository stripeEventLogRepository,
        ITenantRepository tenantRepository,
        ISubscriptionHistoryRepository subscriptionHistoryRepository,
        ISubscriptionSeatRepository subscriptionSeatRepository,
        IUserTenantMembershipRepository userTenantMembershipRepository)
    {
        StripeEventLogRepository = stripeEventLogRepository;
        TenantRepository = tenantRepository;
        SubscriptionHistoryRepository = subscriptionHistoryRepository;
        SubscriptionSeatRepository = subscriptionSeatRepository;
        UserTenantMembershipRepository = userTenantMembershipRepository;
    }

    /// <summary>
    /// Stripe event log repository.
    /// </summary>
    public IStripeEventLogRepository StripeEventLogRepository { get; }

    /// <summary>
    /// Tenant repository.
    /// </summary>
    public ITenantRepository TenantRepository { get; }

    /// <summary>
    /// Subscription history repository.
    /// </summary>
    public ISubscriptionHistoryRepository SubscriptionHistoryRepository { get; }

    /// <summary>
    /// Subscription seat repository.
    /// </summary>
    public ISubscriptionSeatRepository SubscriptionSeatRepository { get; }

    /// <summary>
    /// User-tenant membership repository.
    /// </summary>
    public IUserTenantMembershipRepository UserTenantMembershipRepository { get; }
}
