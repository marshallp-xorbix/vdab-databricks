using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Microsoft.Extensions.Hosting;

/// <summary>
/// Extension methods for configuring authentication and authorization policies.
/// </summary>
public static class AuthenticationExtensions
{
    /// <summary>
    /// Adds JWT authentication and authorization policies using constants from AuthPolicies and AuthRoles.
    /// </summary>
    /// <param name="builder">The host application builder.</param>
    /// <returns>The builder instance for chaining.</returns>
    public static IHostApplicationBuilder AddAuthenticationWithPolicies(
        this IHostApplicationBuilder builder)
    {
        using var loggerFactory = LoggerFactory.Create(logging => logging.AddConsole());
        var logger = loggerFactory.CreateLogger("AuthenticationExtensions");
        logger.LogInformation("Configuring Authentication and Authorization policies...");

        JwtConfiguration jwtConfig = builder.Configuration.GetSection(JwtConfiguration.ConfigurationSectionName)
            .Get<JwtConfiguration>()
            ?? throw new InvalidOperationException(
                $"JWT configuration section '{JwtConfiguration.ConfigurationSectionName}' not found in configuration.");

        string secretKey = jwtConfig.SecretKey
            ?? throw new InvalidOperationException("JWT SecretKey is required.");
        string issuer = jwtConfig.Issuer
            ?? throw new InvalidOperationException("JWT Issuer is required.");
        string audience = jwtConfig.Audience
            ?? throw new InvalidOperationException("JWT Audience is required.");

        logger.LogInformation("JWT Configuration found. Issuer: {Issuer}, Audience: {Audience}", issuer, audience);

        // Configure authentication schemes
        builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };

            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = context =>
                {
                    if (context.Exception.GetType() == typeof(SecurityTokenExpiredException))
                    {
                        context.Response.Headers.Append(AuthResponseHeaders.TokenExpired, "true");
                    }
                    return Task.CompletedTask;
                },
                OnTokenValidated = AccessTokenSessionValidationHandler.HandleAsync
            };
        })
        .AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>(AuthSchemes.ApiKey, options =>
         {
             // Configure API key authentication if needed for external APIs
             options.ApiKeyHeaderName = "X-API-Key";
         });

        // Configure authorization policies using constants
        builder.Services.AddAuthorizationBuilder()
            // Default policy applies when [Authorize] is used without specifying a policy
            .SetDefaultPolicy(new AuthorizationPolicyBuilder()
                .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
                .RequireAuthenticatedUser()
                .Build())
            // Policy that accepts either JWT or API Key (for external agents)
            .AddPolicy(AuthPolicies.ApiAccess, policy =>
            {
                logger.LogInformation("Registering Policy: {PolicyName}", AuthPolicies.ApiAccess);
                policy.AuthenticationSchemes.Add(JwtBearerDefaults.AuthenticationScheme);
                policy.AuthenticationSchemes.Add(AuthSchemes.ApiKey);
                policy.RequireAuthenticatedUser();
            })
            // Global Administrator - no tenant context required
            .AddPolicy(AuthPolicies.RequireAdministratorRole, policy =>
            {
                logger.LogInformation("Registering Policy: {PolicyName}", AuthPolicies.RequireAdministratorRole);
                policy.AuthenticationSchemes.Add(JwtBearerDefaults.AuthenticationScheme);
                policy.RequireRole(AuthRoles.Administrator);
            })
            // Tenant-scoped policies - Administrator bypasses tenant check; tenant roles require valid tenant context
            .AddPolicy(AuthPolicies.RequireTenantAdminRole, policy =>
            {
                logger.LogInformation("Registering Policy: {PolicyName}", AuthPolicies.RequireTenantAdminRole);
                policy.AuthenticationSchemes.Add(JwtBearerDefaults.AuthenticationScheme);
                policy.RequireAuthenticatedUser();
                // Explicitly allow both tenant admins and global administrators.
                policy.AddRequirements(new TenantRoleRequirement(AuthRoles.TenantAdmin, AuthRoles.Administrator));
            })
            .AddPolicy(AuthPolicies.RequireDeveloperRole, policy =>
            {
                logger.LogInformation("Registering Policy: {PolicyName}", AuthPolicies.RequireDeveloperRole);
                policy.AuthenticationSchemes.Add(JwtBearerDefaults.AuthenticationScheme);
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(new TenantRoleRequirement(AuthRoles.Developer, AuthRoles.TenantAdmin));
            })
            .AddPolicy(AuthPolicies.RequireTenantMembership, policy =>
            {
                logger.LogInformation("Registering Policy: {PolicyName}", AuthPolicies.RequireTenantMembership);
                policy.AuthenticationSchemes.Add(JwtBearerDefaults.AuthenticationScheme);
                policy.RequireAuthenticatedUser();
                // Tenant membership with a Developer-or-higher tenant role. No global Administrator bypass:
                // a global admin must be a member of the tenant (carry its tenant_id + tenant_role) to qualify.
                policy.AddRequirements(
                    new TenantRoleRequirement(AuthRoles.Developer, AuthRoles.TenantAdmin)
                    {
                        AllowGlobalAdministratorBypass = false
                    });
            });

        return builder;
    }

    /// <summary>
    /// Adds API Key authentication scheme. Must be called after AddAuthenticationWithPolicies or AddAuthentication.
    /// </summary>
    /// <typeparam name="TApiKeyAuthenticationHandler">The API key authentication handler type.</typeparam>
    /// <param name="builder">The host application builder.</param>
    /// <param name="apiKeyHeaderName">The header name for API key (default: "X-API-Key").</param>
    /// <returns>The builder instance for chaining.</returns>
    public static IHostApplicationBuilder AddApiKeyAuthentication<TApiKeyAuthenticationHandler>(
        this IHostApplicationBuilder builder,
        string apiKeyHeaderName = "X-API-Key")
        where TApiKeyAuthenticationHandler : Microsoft.AspNetCore.Authentication.AuthenticationHandler<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions>
    {
        builder.Services.AddAuthentication()
            .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, TApiKeyAuthenticationHandler>(
                "ApiKey",
                options => { });

        return builder;
    }
}

