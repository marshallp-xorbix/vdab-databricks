using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services.BindingDefinition;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Extension methods for registering Services layer dependencies.
/// </summary>
public static class ServicesServiceCollectionExtensions
{
    /// <summary>
    /// Registers all application services in the dependency injection container.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IDatabricksConnectionService, DatabricksConnectionService>();
        services.AddScoped<IDatabricksWorkspaceConnectionValidator, DatabricksWorkspaceConnectionValidator>();
        services.AddScoped<ITenantResourceGuard, TenantResourceGuard>();
        services.AddScoped<IDatabricksAppProvisioningService, DatabricksAppProvisioningService>();
        services.AddScoped<IAppService, AppService>();
        services.AddScoped<IAppComponentService, AppComponentService>();
        services.AddScoped<IAppImportExportService, AppImportExportService>();
        services.AddScoped<IDatabricksConnectionImportExportService, DatabricksConnectionImportExportService>();
        services.AddScoped<IAppActionService, AppActionService>();
        services.AddScoped<IStreamlitTemplateService, StreamlitTemplateService>();
        services.AddScoped<IDeployService, DeployService>();
        services.AddScoped<IDatabricksApiService, DatabricksApiService>();
        services.AddScoped<IDatabricksWorkspaceConnectionResolver, DatabricksWorkspaceConnectionResolver>();
        services.AddScoped<IDatabricksUnityCatalogService, DatabricksUnityCatalogService>();
        services.AddScoped<IDatabricksJobService, DatabricksJobService>();
        services.AddScoped<IDatabricksSqlWarehouseService, DatabricksSqlWarehouseService>();
        services.AddScoped<IDatabricksLakebaseDatabaseService, DatabricksLakebaseDatabaseService>();
        services.AddScoped<IDatabricksServingEndpointService, DatabricksServingEndpointService>();
        services.AddScoped<IDatabricksExperimentService, DatabricksExperimentService>();
        services.AddScoped<IDatabricksGenieSpaceService, DatabricksGenieSpaceService>();
        services.AddScoped<IDatabricksSecretService, DatabricksSecretService>();
        services.AddScoped<IDatabricksDataConnectorService, DatabricksDataConnectorService>();
        services.AddScoped<IDatabricksAccessTokenCache, DatabricksAccessTokenCache>();
        services.AddSingleton<IGeoLocationService, GeoLocationService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IAccessTokenSessionValidator, AccessTokenSessionValidator>();
        services.AddScoped<IUserTenantMembershipService, UserTenantMembershipService>();
        services.AddScoped<ITenantAccessRevocationService, TenantAccessRevocationService>();
        services.AddScoped<ISubscriptionTierService, SubscriptionTierService>();
        services.AddSingleton<IInternalDevTenantService, InternalDevTenantService>();
        services.AddScoped<ISeatManagementService, SeatManagementService>();
        services.AddScoped<ITenantLimitService, TenantLimitService>();
        services.AddScoped<IStripeCustomerService, StripeCustomerService>();
        services.AddScoped<IStripeSubscriptionService, StripeSubscriptionService>();
        services.AddScoped<IStripePromotionCodeService, StripePromotionCodeService>();
        services.AddScoped<IBetaCodeService, BetaCodeService>();
        services.AddScoped<StripeWebhookRepositorySet>();
        services.AddScoped<IStripeWebhookService, StripeWebhookService>();
        services.AddScoped<IStripeEventLogService, StripeEventLogService>();
        services.AddScoped<ITenantService, TenantService>();
        services.AddScoped<ISubscriptionHistoryService, SubscriptionHistoryService>();
        services.AddScoped<ITenantInviteService, TenantInviteService>();
        services.AddScoped<IAuthResponseService, AuthResponseService>();
        services.AddScoped<IAccountAccessPolicy, AccountAccessPolicy>();
        services.AddScoped<IPersonalWorkspaceService, PersonalWorkspaceService>();
        services.AddScoped<IVerificationChallengeService, VerificationChallengeService>();
        services.AddScoped<IVerificationThrottleService, VerificationThrottleService>();
        services.AddScoped<IPasswordLifecycleService, PasswordLifecycleService>();
        services.AddScoped<ISessionTokenSecurityService, SessionTokenSecurityService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserSessionService, UserSessionService>();
        services.AddScoped<IUserProvisioningService, UserProvisioningService>();
        services.AddScoped<IUserLifecycleService, UserLifecycleService>();
        services.AddScoped<ITenantLifecycleService, TenantLifecycleService>();
        services.AddSingleton<IEmailSenderService, EmailSenderService>();
        services.AddSingleton<IEmailSender<ApplicationUser>>(sp => sp.GetRequiredService<IEmailSenderService>());
        services.AddSingleton<IStripeClient>(serviceProvider =>
        {
            IOptions<StripeSettings> stripeOptions = serviceProvider.GetRequiredService<IOptions<StripeSettings>>();
            StripeSettings stripeSettings = stripeOptions.Value;

            if (string.IsNullOrWhiteSpace(stripeSettings.SecretKey))
            {
                throw new InvalidOperationException($"Missing required configuration: {StripeSettings.ConfigurationSectionName}:SecretKey");
            }

            return new StripeClient(stripeSettings.SecretKey);
        });
        services.AddSingleton<IBindingDefinitionService, BindingDefinitionService>();
        services.AddComponentRegistry();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IManagementService, ManagementService>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IReportsService, ReportsService>();
        services.AddScoped<ILegalContentService, LegalContentService>();

        services.AddWorkflowServices();

        services.AddScoped<IAiBuilderContextService, AiBuilderContextService>();
        services.AddScoped<IAiBuilderService, AiBuilderService>();
        services.AddScoped<IAiModelResolverService, AiModelResolverService>();
        services.AddScoped<IAiBuilderKernelFactory, AiBuilderKernelFactory>();
        services.AddScoped<ITenantAiModelValidationService, TenantAiModelValidationService>();
        services.AddScoped<IAiBuilderModelSelectionService, AiBuilderModelSelectionService>();
        services.AddScoped<ITenantAiModelService, TenantAiModelService>();
        services.AddScoped<IPlatformAiQuotaService, PlatformAiQuotaService>();

        return services;
    }
}
