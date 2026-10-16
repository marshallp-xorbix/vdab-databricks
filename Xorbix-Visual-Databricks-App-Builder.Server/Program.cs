using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.FeatureManagement;
using Scalar.AspNetCore;
using System.Globalization;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Server.Extensions;
using Xorbix_Visual_Databricks_App_Builder.Server.Middleware;
using Xorbix_Visual_Databricks_App_Builder.Server.Services;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Caching.Hybrid;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

// Log startup using builder's logging
builder.Logging.AddConsole();
var loggerFactory = LoggerFactory.Create(logging => logging.AddConsole());
var startupLogger = loggerFactory.CreateLogger<Program>();
startupLogger.LogTrace("Environment: {Environment}", builder.Environment.EnvironmentName);

// Determine Authentication Method
// Priority 1: Explicit Service Principal (Client ID + Secret) from config
// Priority 2: DefaultAzureCredential (VS, VS Code, Azure CLI, Managed Identity)
var credential = builder.CreateKeyVaultCredential(startupLogger);

// configuration
builder.AddAzureKeyVaultConfiguration(credential);

// local config with secrets, will override other settings.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// When the Aspire AppHost provisions the local database (managed mode), it injects that container's
// connection string under the DISTINCT name ConnectionStrings:AspireInjected. Promote it to
// ConnectionStrings:PostgreSql so the rest of the app reads a single key. The distinct source name makes
// this a deliberate, explicit override rather than a same-name reshuffle. When it is absent (running
// outside the AppHost, or against an external database) the ConnectionStrings:PostgreSql value from
// appsettings.Local.json / Key Vault is used unchanged — so you can point the app at any database.
string? aspireInjectedConnectionString =
    builder.Configuration.GetConnectionString(ConnectionStrings.AspireInjectedConnectionName);
if (!string.IsNullOrWhiteSpace(aspireInjectedConnectionString))
{
    builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
    {
        [$"{ConnectionStrings.ConfigurationSectionName}:{nameof(ConnectionStrings.PostgreSql)}"] = aspireInjectedConnectionString,
    });
}

// Bind configuration options

builder.Services.AddOptions<ConnectionStrings>()
    .Bind(builder.Configuration.GetSection(ConnectionStrings.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<DatabricksConfiguration>()
    .Bind(builder.Configuration.GetSection(DatabricksConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<DatabricksAiConfiguration>()
    .Bind(builder.Configuration.GetSection(DatabricksAiConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<PlatformAiQuotaConfiguration>()
    .Bind(builder.Configuration.GetSection(PlatformAiQuotaConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<JwtConfiguration>()
    .Bind(builder.Configuration.GetSection(JwtConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<ApplicationConfiguration>()
    .Bind(builder.Configuration.GetSection(ApplicationConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<EmailConfiguration>()
    .Bind(builder.Configuration.GetSection(EmailConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
// Debug:Skip2FA makes verification accept ANY code — a complete second-factor bypass. Force it off
// outside Development so a stray appsettings value can never disable 2FA in a deployed environment.
// This guard only covers Staging/Production; a Development-hosted deployment must also keep
// Skip2FA false in appsettings.Development.json, since it legitimately reports IsDevelopment().
string skip2FaConfigurationKey =
    $"{DebugConfiguration.ConfigurationSectionName}:{nameof(DebugConfiguration.Skip2FA)}";

if (!builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>(skip2FaConfigurationKey))
{
    startupLogger.LogWarning(
        "Debug:Skip2FA was enabled in the {Environment} environment and has been forced off.",
        builder.Environment.EnvironmentName);
    builder.Configuration[skip2FaConfigurationKey] = "false";
}

builder.Services.AddOptions<DebugConfiguration>()
    .Bind(builder.Configuration.GetSection(DebugConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<GeoLiteConfiguration>()
    .Bind(builder.Configuration.GetSection(GeoLiteConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<AuditArchiveConfiguration>()
    .Bind(builder.Configuration.GetSection(AuditArchiveConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<StripeSettings>()
    .Bind(builder.Configuration.GetSection(StripeSettings.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<SubscriptionTierSettings>()
    .Bind(builder.Configuration.GetSection(SubscriptionTierSettings.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<TenantInviteConfiguration>()
    .Bind(builder.Configuration.GetSection(TenantInviteConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<InternalDevTenantsConfiguration>()
    .Bind(builder.Configuration.GetSection(InternalDevTenantsConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<PolicyConsentConfiguration>()
    .Bind(builder.Configuration.GetSection(PolicyConsentConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<WordPressConfiguration>()
    .Bind(builder.Configuration.GetSection(WordPressConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);
builder.Services.AddOptions<AuthenticationConfiguration>()
    .Bind(builder.Configuration.GetSection(AuthenticationConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);

builder.Services.AddOptions<AccountLifecycleConfiguration>()
    .Bind(builder.Configuration.GetSection(AccountLifecycleConfiguration.ConfigurationSectionName),
        options => options.BindNonPublicProperties = true);

//add feature flag support
builder.Services.AddFeatureManagement();

// Limit anonymous feature-flag probing by source IP.
builder.Services.AddRateLimiter(options =>
{
    int featuresAnonymousPermitLimit = Math.Max(1, RateLimitingDefaults.FeaturesAnonymousPermitLimit);
    int featuresAnonymousWindowSeconds = Math.Max(1, RateLimitingDefaults.FeaturesAnonymousWindowSeconds);
    string xForwardedForHeaderName = RateLimitingDefaults.ForwardedForHeaderName;
    TimeSpan featuresAnonymousWindow = TimeSpan.FromSeconds(featuresAnonymousWindowSeconds);

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        ILogger<Program> rejectionLogger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
        rejectionLogger.LogWarning(
            "Rate limit exceeded for {Method} {Path} from IP {IpAddress}",
            context.HttpContext.Request.Method,
            context.HttpContext.Request.Path,
            context.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");

        ProblemDetails problemDetails = new()
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too Many Requests",
            Detail = "Rate limit exceeded. Retry after a short delay."
        };

        // Mirror the retry-after shape that HandleFluentResult emits for a service-level
        // TooManyRequestsError, so a backstop 429 also drives the SPA's resend countdown
        // (useLoginWorkflow.readRetryAfter reads the retryAfter body extension). The header is a
        // seconds delta per RFC 9110; the body carries the absolute UTC instant the client parses.
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter))
        {
            int retryAfterSeconds = Math.Max(0, (int)Math.Ceiling(retryAfter.TotalSeconds));
            context.HttpContext.Response.Headers.RetryAfter =
                retryAfterSeconds.ToString(CultureInfo.InvariantCulture);
            problemDetails.Extensions["retryAfter"] = DateTime.UtcNow.Add(retryAfter);
        }

        await context.HttpContext.Response.WriteAsJsonAsync(
            problemDetails,
            cancellationToken: cancellationToken);
    };

    options.AddPolicy(RateLimitingPolicyNames.FeaturesAnonymous, httpContext =>
    {
        return RateLimitPartition.GetFixedWindowLimiter(
            ResolveClientPartitionKey(httpContext, xForwardedForHeaderName),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = featuresAnonymousPermitLimit,
                Window = featuresAnonymousWindow,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            });
    });

    // Outer backstop for the anonymous identity endpoints. Brute-force protection proper lives in
    // IVerificationThrottleService, which throttles per email; this only blunts crude IP-level flooding.
    // It partitions per real client IP (see the ResolveClientPartitionKey / UseForwardedHeaders notes
    // below) and is sized generously, so one client's flood cannot reject another client's sign-in.
    int identityAnonymousPermitLimit = Math.Max(1, RateLimitingDefaults.IdentityAnonymousPermitLimit);
    TimeSpan identityAnonymousWindow = TimeSpan.FromSeconds(Math.Max(1, RateLimitingDefaults.IdentityAnonymousWindowSeconds));

    options.AddPolicy(RateLimitingPolicyNames.IdentityAnonymous, httpContext =>
    {
        return RateLimitPartition.GetFixedWindowLimiter(
            ResolveClientPartitionKey(httpContext, xForwardedForHeaderName),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = identityAnonymousPermitLimit,
                Window = identityAnonymousWindow,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            });
    });
});

// Resolves the rate-limiter partition for a caller, preferring the connection IP and falling back to
// the forwarded header only when the connection address is unavailable.
static string ResolveClientPartitionKey(HttpContext httpContext, string forwardedForHeaderName)
{
    string partitionKey = httpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;

    if (string.IsNullOrWhiteSpace(partitionKey))
    {
        partitionKey = httpContext.Request.Headers[forwardedForHeaderName].ToString();
    }

    return string.IsNullOrWhiteSpace(partitionKey) ? "unknown" : partitionKey;
}

// Forwarded-headers handling for the anonymous rate limiter behind a reverse proxy.
//
// Behind a proxy the TCP connection comes from the proxy, so the real client IP arrives in the
// X-Forwarded-For (XFF) header rather than the raw connection. UseForwardedHeaders rewrites
// HttpContext.Connection.RemoteIpAddress from XFF, and it runs BEFORE UseRateLimiter, so the limiter
// partitions on the resolved value (as do the controllers and the audit log, which read the same
// RemoteIpAddress).
//
// UseForwardedHeaders only honors XFF when the immediate sender is in KnownProxies / KnownNetworks,
// which by default contain ONLY loopback. On Azure App Service the platform front-end forwards to the
// worker over loopback, so the default (loopback-only, TrustAllForwardedHeaders = false) is enough for
// UseForwardedHeaders to resolve the real client IP. VERIFIED in staging and production: session and
// audit records — which read this same RemoteIpAddress — show the correct client IP, so the limiter
// partitions PER REAL CLIENT, not on a shared front-end IP, and the in-policy XFF fallback never fires
// (RemoteIpAddress is populated). Note this is a property of the App Service ingress topology, not a
// code guarantee: if a future non-loopback proxy is inserted without being registered below,
// RemoteIpAddress could revert to a shared address and the backstop would coarsen — which is why it
// stays a backstop, with IVerificationThrottleService as the real per-email control.
//
// Do NOT set TrustAllForwardedHeaders = true in production unless a trusted proxy in front STRIPS any
// client-supplied XFF. With the current default the platform appends the real client IP to XFF and the
// default ForwardLimit takes it, so a caller cannot forge its own partition key; clearing the lists
// would let any caller spoof "X-Forwarded-For: <anything>" to dodge the IP limit or frame another IP.
//
// If the topology changes, trust a KNOWN ingress proxy rather than clearing the lists: for Application
// Gateway add its subnet via options.KnownNetworks.Add(new IPNetwork(...)); for Front Door validate the
// X-Azure-FDID header rather than IPs.
if (RateLimitingDefaults.EnableForwardedHeaders)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

        if (RateLimitingDefaults.TrustAllForwardedHeaders)
        {
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        }
    });

    if (RateLimitingDefaults.TrustAllForwardedHeaders)
    {
        startupLogger.LogWarning("RateLimitingDefaults.TrustAllForwardedHeaders is enabled. Only use this in trusted network topologies.");
    }
}

// Configure Data Protection for Multi-Server/Production Environments
//
// WHY:
// By default, ASP.NET Core stores Data Protection keys locally. In a scaled environment (e.g., Azure App Service with multiple instances),
// each instance will have its own isolated key ring. This causes "Invalid Token" errors for email confirmation, password resets,
// and auth tokens if the request is handled by a different server instance than the one that generated it.
//
// HOW:
// 1. Install NuGet packages:
//    - Azure.Extensions.AspNetCore.DataProtection.Blobs
//    - Azure.Extensions.AspNetCore.DataProtection.Keys
// 2. Uncomment the code below to persist keys to a shared Blob Storage container and protect them with Azure Key Vault.
// 3. Ensure 'Encryption:BlobUri' and 'Encryption:KeyUri' are configured in AppSettings or Azure App Configuration.

var encryptionBlobUri = builder.Configuration["Encryption:BlobUri"];
var encryptionKeyUri = builder.Configuration["Encryption:KeyUri"];

if (!string.IsNullOrEmpty(encryptionBlobUri) && !string.IsNullOrEmpty(encryptionKeyUri))
{
    builder.Services.AddDataProtection()
        .PersistKeysToAzureBlobStorage(
            new Uri(encryptionBlobUri),
            credential)
        .ProtectKeysWithAzureKeyVault(
            new Uri(encryptionKeyUri),
            credential)
        .SetApplicationName("XorbixVisualDatabricksAppBuilder");
}
else
{
    startupLogger.LogWarning("Data Protection keys are missing (Encryption:BlobUri or Encryption:KeyUri). Data Protection will use local storage (not recommended for production).");
}

// Add DbContext
var sqlConnectionString = builder.Configuration.GetConnectionString(nameof(ConnectionStrings.PostgreSql));
if (string.IsNullOrEmpty(sqlConnectionString))
{
    startupLogger.LogCritical("PostgreSql connection string '{ConnectionName}' is missing.", nameof(ConnectionStrings.PostgreSql));
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString(nameof(ConnectionStrings.PostgreSql)),
        x => x
            .MigrationsAssembly(Assembly.GetAssembly(typeof(ApplicationDbContext))!));
});

// Distributed cache for passwordless verification codes
// Currently uses in-memory cache (single server only)
// For multi-server production: replace with Redis using AddStackExchangeRedisCache()
builder.Services.AddDistributedMemoryCache();
builder.Services.AddMemoryCache();

builder.Services.AddHybridCache(options =>
{
    options.DefaultEntryOptions = new Microsoft.Extensions.Caching.Hybrid.HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(60),
        LocalCacheExpiration = TimeSpan.FromMinutes(60)
    };
    // TODO: Think about Redis backing for production.
});

builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IAiBuilderGatewayTagContext, AiBuilderGatewayTagContext>();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Add named HttpClient for Databricks
builder.Services.AddHttpClient(DatabricksConfiguration.HttpClientName, (serviceProvider, client) =>
{
    DatabricksConfiguration databricksConfig = serviceProvider.GetRequiredService<IOptions<DatabricksConfiguration>>().Value;

    client.Timeout = TimeSpan.FromSeconds(databricksConfig.TimeoutSeconds);
    client.DefaultRequestHeaders.UserAgent.ParseAdd(databricksConfig.UserAgent);
    client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
});

// Add named HttpClient for Databricks AI Gateway (consumed by the Semantic Kernel singleton).
// The sanitizer handler normalizes chat-completions bodies for reasoning-model tool calling.
// The tagging handler stamps the calling user onto outbound requests for usage attribution.
// Aspire's ConfigureHttpClientDefaults adds a standard resilience handler with a 30s total
// timeout; replace it for this client so tool-calling chat completions can finish.
builder.Services.AddTransient<DatabricksAiChatCompletionsRequestSanitizerHandler>();
builder.Services.AddTransient<DatabricksAiRequestTaggingHandler>();
IHttpClientBuilder databricksAiHttpClient = builder.Services.AddHttpClient(
    DatabricksAiConfiguration.HttpClientName,
    (serviceProvider, client) =>
    {
        DatabricksConfiguration databricksConfig = serviceProvider.GetRequiredService<IOptions<DatabricksConfiguration>>().Value;
        client.DefaultRequestHeaders.UserAgent.ParseAdd(databricksConfig.UserAgent);
        // Resilience pipeline owns the timeout; keep HttpClient unbounded.
        client.Timeout = Timeout.InfiniteTimeSpan;
    });
databricksAiHttpClient
    .AddHttpMessageHandler<DatabricksAiChatCompletionsRequestSanitizerHandler>()
    .AddHttpMessageHandler<DatabricksAiRequestTaggingHandler>();
#pragma warning disable EXTEXP0001 // RemoveAllResilienceHandlers is experimental but required to replace Aspire's 30s default
databricksAiHttpClient.RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
databricksAiHttpClient.AddStandardResilienceHandler(options =>
{
    DatabricksAiConfiguration aiConfig = builder.Configuration
        .GetSection(DatabricksAiConfiguration.ConfigurationSectionName)
        .Get<DatabricksAiConfiguration>()
        ?? new DatabricksAiConfiguration();
    int timeoutSeconds = Math.Max(1, aiConfig.TimeoutSeconds);
    TimeSpan timeout = TimeSpan.FromSeconds(timeoutSeconds);
    options.AttemptTimeout.Timeout = timeout;
    options.TotalRequestTimeout.Timeout = timeout;
    // Do not retry long-running chat completions — retries amplify latency and token cost.
    // MaxRetryAttempts must be >= 1 for options validation; disable retries via ShouldHandle.
    options.Retry.MaxRetryAttempts = 1;
    options.Retry.ShouldHandle = static _ => ValueTask.FromResult(false);
    // SamplingDuration must be at least 2× AttemptTimeout for the circuit breaker.
    options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(timeoutSeconds * 2);
});

// Named HttpClient for WordPress REST (legal page content).
builder.Services.AddHttpClient(WordPressConfiguration.HttpClientName, (serviceProvider, client) =>
{
    WordPressConfiguration wordPressConfig = serviceProvider.GetRequiredService<IOptions<WordPressConfiguration>>().Value;
    string baseUrl = string.IsNullOrWhiteSpace(wordPressConfig.BaseUrl)
        ? WordPressConfiguration.DefaultBaseUrl
        : wordPressConfig.BaseUrl.TrimEnd('/');

    client.BaseAddress = new Uri($"{baseUrl}/");
    client.Timeout = TimeSpan.FromSeconds(Math.Max(1, wordPressConfig.TimeoutSeconds));
    client.DefaultRequestHeaders.Accept.Add(
        new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
});

// Add Identity
startupLogger.LogTrace("Configuring Identity...");
builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
{
    // Password settings
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;

    // Lockout settings (applies to password-based login attempts)
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // User settings
    options.User.RequireUniqueEmail = true;
    options.SignIn.RequireConfirmedEmail = true; // Require email confirmation
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddUserStore<TombstoneAwareUserStore>()
.AddDefaultTokenProviders(); // Required for email verification code generation

// Configure token lifespan to 3 days for email confirmation
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
{
    options.TokenLifespan = TimeSpan.FromDays(3);
});

// Add custom services (repositories + services via project-level extensions)
builder.Services.AddDataAccessRepositories();
builder.Services.AddApplicationServices();

// Add CORS
builder.Services.AddCors(options =>
{
    string allowedOriginsStr = builder.Configuration.GetSection(ApplicationConfiguration.ConfigurationSectionName)
                                   .GetValue<string>(nameof(ApplicationConfiguration.AllowedOrigins))
                               ?? throw new InvalidOperationException(
                                   $"AllowedOrigins in {ApplicationConfiguration.ConfigurationSectionName} is required.");

    options.AddPolicy(
        name: ApplicationConfiguration.CorsDefault,
        policy => policy.WithOrigins(allowedOriginsStr.Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());

    options.AddPolicy(ApplicationConfiguration.CorsAllowAll, policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.AddServiceDefaults();

// Add authentication and authorization with policies from ServiceDefaults
builder.AddAuthenticationWithPolicies();

builder.Services.AddScoped<IAuditArchivalService, AuditArchivalService>();

// Register the audit filter for DI
builder.Services.AddScoped<AuditLogActionFilter>();

// Register tenant-scoped authorization handler
builder.Services.AddScoped<IAuthorizationHandler, TenantAuthorizationHandler>();

builder.Services.AddControllers(options =>
{
    options.Filters.AddService<AuditLogActionFilter>();
}).ConfigureApiBehaviorOptions(options =>
{
    // [ApiController] swallows model validation failures before they reach global exception handling.
    // Keep logging here, and use built-in ProblemDetailsFactory for payload creation.
    options.InvalidModelStateResponseFactory = context =>
    {
        IEnumerable<string> errors = context.ModelState.Values
            .SelectMany(v => v.Errors)
            .Select(e => e.ErrorMessage);

        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogWarning("Model validation failed for {Method} {Path}: {Errors}",
            context.HttpContext.Request.Method,
            context.HttpContext.Request.Path,
            string.Join("; ", errors));

        var problemDetailsFactory = context.HttpContext.RequestServices.GetRequiredService<ProblemDetailsFactory>();
        ValidationProblemDetails problemDetails = problemDetailsFactory.CreateValidationProblemDetails(
            context.HttpContext,
            context.ModelState,
            statusCode: StatusCodes.Status400BadRequest,
            instance: $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}");
        problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;

        return new BadRequestObjectResult(problemDetails);
    };
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    //TODO: Test this, reduces what is sent
    //options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});

builder.Services.AddOpenApi();

// HTTP request/response logging (controlled by Logging:LogLevel in appsettings)
builder.Services.AddHttpLogging(options =>
{
    // Log request and response headers + status; body logging disabled by default for safety
    options.LoggingFields = Microsoft.AspNetCore.HttpLogging.HttpLoggingFields.RequestPath
        | Microsoft.AspNetCore.HttpLogging.HttpLoggingFields.RequestMethod
        | Microsoft.AspNetCore.HttpLogging.HttpLoggingFields.RequestQuery
        | Microsoft.AspNetCore.HttpLogging.HttpLoggingFields.ResponseStatusCode
        | Microsoft.AspNetCore.HttpLogging.HttpLoggingFields.Duration;
    options.RequestBodyLogLimit = 0;  // No request body in logs (PII safety)
    options.ResponseBodyLogLimit = 0; // No response body in logs
});

var app = builder.Build();

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogTrace("Application built successfully");

if (app.Environment.IsDevelopment())
{
    try
    {
        using IServiceScope scope = app.Services.CreateScope();
        ApplicationDbContext dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        string[] pendingMigrations = [.. await dbContext.Database.GetPendingMigrationsAsync()];

        if (pendingMigrations.Length > 0)
        {
            string errorMessage = $"Pending EF migrations detected: {string.Join(", ", pendingMigrations)}. Apply migrations manually before starting the application.";
            logger.LogCritical(errorMessage);
            throw new InvalidOperationException(errorMessage);
        }
        else
        {
            logger.LogInformation("No pending EF migrations detected.");
        }
    }
    catch (Exception ex)
    {
        if (ex is InvalidOperationException)
        {
            throw;
        }

        logger.LogWarning(ex, "Unable to check for pending EF migrations during startup.");
    }
}

// Download GeoLite2 database from Azure Blob Storage if not cached locally
await app.EnsureGeoLiteDatabaseAsync(credential);

app.MapDefaultEndpoints();
app.MapHealthChecks("/health/details", new HealthCheckOptions
{
    ResultStatusCodes =
    {
        [HealthStatus.Healthy] = StatusCodes.Status200OK,
        [HealthStatus.Degraded] = StatusCodes.Status200OK,
        [HealthStatus.Unhealthy] = StatusCodes.Status200OK,
    },

    ResponseWriter = async (context, report) =>
    {
        var response = new
        {
            status = report.Status.ToString(),

            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
                description = entry.Value.Description,
                durationMs = entry.Value.Duration.TotalMilliseconds
            })
        };

        await context.Response.WriteAsJsonAsync(response);
    }
}).RequireAuthorization(AuthPolicies.RequireAdministratorRole);

app.MapGet("/status", async (
    HybridCache statusCache, 
    HealthCheckService healthCheckService, 
    CancellationToken cancellationToken) =>
{
    PlatformStatusResponse payload =
        await statusCache.GetOrCreateAsync(
            "platform-status",
            async token =>
            {
                HealthReport report =
                    await healthCheckService.CheckHealthAsync(token);

                bool paymentsAvailable =
                    report.Entries.TryGetValue("Stripe", out var stripeEntry)
                    && stripeEntry.Status == HealthStatus.Healthy;

                bool aiAvailable =
                    report.Entries.TryGetValue("DatabricksAi", out var aiEntry)
                    && aiEntry.Status == HealthStatus.Healthy;

                string platformStatus =
                    paymentsAvailable && aiAvailable
                        ? "Operational"
                        : paymentsAvailable || aiAvailable
                            ? "Partial Outage"
                            : "Major Outage";

                return new PlatformStatusResponse
                {
                    PlatformStatus = platformStatus,
                    PaymentsAvailable = paymentsAvailable,
                    AiAvailable = aiAvailable
                };
            },
            new HybridCacheEntryOptions
            {
                Expiration = TimeSpan.FromSeconds(15),
                LocalCacheExpiration = TimeSpan.FromSeconds(15)
            },
            cancellationToken: cancellationToken);
    return Results.Json(payload);
}).AllowAnonymous().RequireRateLimiting(RateLimitingPolicyNames.FeaturesAnonymous);

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    logger.LogTrace("In Development environment - enabling OpenAPI and API Explorer");

    // for api documentation, and for creating definition for use in dev api explorer
    app.MapOpenApi().AllowAnonymous(); // Dev API docs endpoint

    // api explorer ui - scalar (allow anonymous access for dev tools)
    app.MapScalarApiReference(options =>
    {
        // Scalar endpoints should be accessible without authentication in dev
        options.WithDefaultHttpClient(ScalarTarget.CSharp, ScalarClient.HttpClient);
    }).AllowAnonymous(); // Dev API explorer endpoint

    app.UseCors(ApplicationConfiguration.CorsDefault);
}
else
{
    app.UseCors(ApplicationConfiguration.CorsDefault);
}

app.UseHttpsRedirection();

// HTTP logging middleware (level controlled via Logging:Microsoft.AspNetCore.HttpLogging in appsettings)
if (app.Environment.IsDevelopment())
{
    app.UseHttpLogging();
}

app.UseExceptionHandler();

if (RateLimitingDefaults.EnableForwardedHeaders)
{
    app.UseForwardedHeaders();
}

app.UseRateLimiter();

// Add authentication and authorization middleware
app.UseAuthentication();
app.UseAuthorization();

// Add logging context middleware (must be after Authorization to access User claims)
app.UseMiddleware<LogContextMiddleware>();

app.MapControllers();
app.MapFallbackToFile("/index.html");

logger.LogInformation("Application configured and ready to start");
logger.LogInformation("Listening on: {Urls}", string.Join(", ", app.Urls));

app.Run();

logger.LogInformation("Application shutting down");
