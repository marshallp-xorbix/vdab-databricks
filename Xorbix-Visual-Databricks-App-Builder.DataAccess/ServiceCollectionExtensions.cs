using Microsoft.Extensions.DependencyInjection;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Extension methods for registering DataAccess layer services.
/// </summary>
public static class DataAccessServiceCollectionExtensions
{
    /// <summary>
    /// Registers all DataAccess repositories in the dependency injection container.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddDataAccessRepositories(this IServiceCollection services)
    {
        services.AddTransient<IDatabricksConnectionRepository, DatabricksConnectionRepository>();
        services.AddTransient<IDatabricksUserTokenRepository, DatabricksUserTokenRepository>();
        services.AddTransient<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddTransient<IAppRepository, AppRepository>();
        services.AddTransient<IAppComponentRepository, AppComponentRepository>();
        services.AddTransient<IUserRepository, UserRepository>();
        services.AddTransient<IUserTenantMembershipRepository, UserTenantMembershipRepository>();
        services.AddTransient<ITenantRepository, TenantRepository>();
        services.AddTransient<IAuditLogRepository, AuditLogRepository>();
        services.AddTransient<IStripeEventLogRepository, StripeEventLogRepository>();
        services.AddTransient<ISubscriptionSeatRepository, SubscriptionSeatRepository>();
        services.AddTransient<ISubscriptionHistoryRepository, SubscriptionHistoryRepository>();
        services.AddTransient<ITenantInviteRepository, TenantInviteRepository>();
        services.AddTransient<IBetaCodeRepository, BetaCodeRepository>();
        services.AddTransient<ITenantAiModelRepository, TenantAiModelRepository>();
        services.AddTransient<IUserTenantPreferenceRepository, UserTenantPreferenceRepository>();
        services.AddTransient<IUserPlatformAiUsageRepository, UserPlatformAiUsageRepository>();
        services.AddSingleton<IEncryptionHelper, EncryptionHelper>();

        return services;
    }
}
