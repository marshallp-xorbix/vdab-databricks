using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using System.Diagnostics;
using Xorbix_Visual_Databricks_App_Builder.HealthChecks;

namespace Microsoft.Extensions.Hosting;

// Adds common Aspire services: service discovery, resilience, health checks, and OpenTelemetry.
// This project should be referenced by each service project in your solution.
// To learn more about using this project, see https://aka.ms/dotnet/aspire/service-defaults
public static class Extensions
{
    private const string HealthEndpointPath = "/health";
    private const string AlivenessEndpointPath = "/alive";

    public static TBuilder AddServiceDefaults<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        // Create a temporary logger for setup diagnostics
        using var loggerFactory = LoggerFactory.Create(logging => logging.AddConsole());
        var logger = loggerFactory.CreateLogger("ServiceDefaults");
        logger.LogInformation("Configuring Service Defaults...");

        builder.ConfigureOpenTelemetry();

        builder.AddDefaultHealthChecks();

        builder.Services.AddServiceDiscovery();

        builder.Services.ConfigureHttpClientDefaults(http =>
        {
            // Turn on resilience by default
            http.AddStandardResilienceHandler();

            // Turn on service discovery by default
            http.AddServiceDiscovery();
        });

        // Uncomment the following to restrict the allowed schemes for service discovery.
        // builder.Services.Configure<ServiceDiscoveryOptions>(options =>
        // {
        //     options.AllowedSchemes = ["https"];
        // });

        return builder;
    }

    /// <summary>
    /// Shared ActivitySource for custom service-layer spans.
    /// Usage: <c>using var activity = Diagnostics.ServiceActivitySource.StartActivity("MyOperation");</c>
    /// </summary>
    public static class Diagnostics
    {
        /// <summary>
        /// ActivitySource for service-layer operations. Register additional sources
        /// via <c>.AddSource(Extensions.Diagnostics.ServiceActivitySource.Name)</c> in tracing config.
        /// </summary>
        public static readonly ActivitySource ServiceActivitySource = new("VDAB.Services");
    }

    public static TBuilder ConfigureOpenTelemetry<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics =>
            {
                metrics.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
            })
            .WithTracing(tracing =>
            {
                tracing.AddSource(builder.Environment.ApplicationName)
                    .AddSource(Diagnostics.ServiceActivitySource.Name)
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        // Exclude health check requests from tracing
                        options.Filter = context =>
                            !context.Request.Path.StartsWithSegments(HealthEndpointPath)
                            && !context.Request.Path.StartsWithSegments(AlivenessEndpointPath);

                        // Record unhandled exceptions on the request span
                        options.RecordException = true;
                        options.EnrichWithHttpRequest = (activity, request) =>
                        {
                            activity.SetTag("http.request.method", request.Method);
                            activity.SetTag("url.path", request.Path);
                            activity.SetTag("url.query", request.QueryString.Value);
                        };
                        options.EnrichWithHttpResponse = (activity, response) =>
                        {
                            activity.SetTag("http.response.status_code", response.StatusCode);
                        };
                    })
                    .AddSqlClientInstrumentation(options =>
                    {
                        // SQL command text is captured by default in v1.15+
                        options.RecordException = true;
                    })
                    .AddHttpClientInstrumentation(options =>
                    {
                        options.RecordException = true;
                    });
            });

        builder.AddOpenTelemetryExporters();

        return builder;
    }

    private static TBuilder AddOpenTelemetryExporters<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        using var loggerFactory = LoggerFactory.Create(logging => logging.AddConsole());
        var logger = loggerFactory.CreateLogger("ServiceDefaults");

        var useOtlpExporter = !string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]);

        if (useOtlpExporter)
        {
            logger.LogInformation("OpenTelemetry: OTLP Exporter Enabled.");
            builder.Services.AddOpenTelemetry().UseOtlpExporter();
        }
        else
        {
            logger.LogInformation("OpenTelemetry: OTLP Exporter Disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set).");
        }

        // Enable Azure Monitor exporter for Application Insights
        string? appInsightsConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"] ?? builder.Configuration.GetConnectionString(nameof(ConnectionStrings.ApplicationInsights));
        if (!string.IsNullOrEmpty(appInsightsConnectionString))
        {
            logger.LogInformation("OpenTelemetry: Azure Monitor Exporter Enabled.");
            builder.Services.AddOpenTelemetry()
               .UseAzureMonitor(options => options.ConnectionString = appInsightsConnectionString);
        }
        else
        {
            logger.LogInformation("OpenTelemetry: Azure Monitor Exporter Disabled (APPLICATIONINSIGHTS_CONNECTION_STRING not set).");
        }

        return builder;
    }

    public static TBuilder AddDefaultHealthChecks<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        //TODO: Add additional health checks as needed, e.g., database connectivity, external service availability, etc.
        // Add a default liveness check to ensure app is responsive.
        builder.Services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
            .AddCheck<StripeHealthCheck>("Stripe", tags: ["ready", "deps"], timeout: TimeSpan.FromSeconds(5))
            .AddCheck<PostgresHealthCheck>("Postgres", tags: ["ready", "deps"], timeout: TimeSpan.FromSeconds(5))
            .AddCheck<EmailServiceHealthCheck>("EmailService", tags: ["ready", "deps"], timeout: TimeSpan.FromSeconds(5))
            .AddCheck<DatabricksAiHealthCheck>( "DatabricksAi", tags: ["ready", "deps"], timeout: TimeSpan.FromSeconds(5));
        return builder;
    }

    public static WebApplication MapDefaultEndpoints(this WebApplication app)
    {
        // Adding health checks endpoints to applications in non-development environments has security implications.
        // See https://aka.ms/dotnet/aspire/healthchecks for details before enabling these endpoints in non-development environments.
        if (app.Environment.IsDevelopment())
        {
            // Readiness checks exclude liveness-only probes and only include dependency checks.
            app.MapHealthChecks(HealthEndpointPath, new HealthCheckOptions
            {
                Predicate = r => r.Tags.Contains("ready") || r.Tags.Contains("deps")
            });

            // Only health checks tagged with the "live" tag must pass for app to be considered alive.
            app.MapHealthChecks(AlivenessEndpointPath, new HealthCheckOptions
            {
                Predicate = r => r.Tags.Contains("live")
            });
        }

        return app;
    }
}
