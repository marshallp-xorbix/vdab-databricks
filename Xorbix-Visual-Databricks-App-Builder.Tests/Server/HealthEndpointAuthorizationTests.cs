using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

public class HealthEndpointAuthorizationTests
{
    [Fact]
    public void HealthDetailsEndpoint_RequiresGlobalAdministratorPolicy()
    {
        WebApplicationBuilder builder = WebApplication.CreateBuilder();

        builder.Services.AddAuthentication("Test")
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });

        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthPolicies.RequireAdministratorRole, policy =>
                policy.RequireRole(AuthRoles.Administrator));
        });
        
        builder.Services.AddHealthChecks();
        WebApplication app = builder.Build();

        app.MapHealthChecks("/health/details", new HealthCheckOptions())
            .RequireAuthorization(AuthPolicies.RequireAdministratorRole);

        app.MapGet("/status", () => Results.Ok()).AllowAnonymous();

        IEndpointRouteBuilder routeBuilder = app;

        RouteEndpoint endpoint = routeBuilder.DataSources
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(entry => entry.RoutePattern.RawText == "/health/details");

        Assert.Contains(
            endpoint.Metadata.OfType<IAuthorizeData>(),
            item => item.Policy == AuthPolicies.RequireAdministratorRole);
        Assert.False(endpoint.Metadata.OfType<IAllowAnonymous>().Any());

        RouteEndpoint statusEndpoint = routeBuilder.DataSources
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(entry => entry.RoutePattern.RawText == "/status");

        Assert.True(statusEndpoint.Metadata.OfType<IAllowAnonymous>().Any());
    }

    private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public TestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }
    }
}
