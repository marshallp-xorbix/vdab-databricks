using System.Net;
using System.Net.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.HealthChecks;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ServiceDefaults;

public class HealthCheckUnitTests
{
    [Fact]
    public void SelfHealthCheck_IsHealthy()
    {
        HealthCheckResult result = HealthCheckResult.Healthy();

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task EmailServiceHealthCheck_ReturnsUnhealthy_WhenConnectionStringMissing()
    {
        var connectionStrings =
            CreateConnectionStrings(communicationService: string.Empty);

        var emailConfiguration =
            CreateEmailConfiguration();


        var healthCheck = new EmailServiceHealthCheck(
            connectionStrings,
            emailConfiguration);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Equal(
            "CommunicationService connection string is missing.",
            result.Description);
    }

    [Fact]
    public async Task EmailServiceHealthCheck_ReturnsUnhealthy_WhenSenderDisplayNameMissing()
    {
        var connectionStrings =
            CreateConnectionStrings();

        var emailConfiguration =
            CreateEmailConfiguration(senderDisplayName: string.Empty);

        var healthCheck = new EmailServiceHealthCheck(
            connectionStrings,
            emailConfiguration);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Equal(
            "EmailConfiguration:SenderDisplayName is not configured.",
            result.Description);
    }

    [Fact]
    public async Task EmailServiceHealthCheck_ReturnsHealthy_WhenConfigurationPresent()
    {
        var connectionStrings =
            CreateConnectionStrings();

        var emailConfiguration =
            CreateEmailConfiguration();

        var healthCheck = new EmailServiceHealthCheck(
            connectionStrings,
            emailConfiguration);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task PostgresHealthCheck_ReturnsUnhealthy_WhenConnectionStringMissing()
    {
        var connectionStrings =
            CreateConnectionStrings(postgres: string.Empty);

        var healthCheck = new PostgresHealthCheck(connectionStrings);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Equal(
            "PostgreSql connection string is missing.",
            result.Description);
    }

    [Fact]
    public async Task StripeHealthCheck_ReturnsHealthy_WhenEndpointReturnsSuccess()
    {
        var handler = new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK));

        var client = new HttpClient(handler);

        var healthCheck = new StripeHealthCheck(client);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task StripeHealthCheck_ReturnsDegraded_WhenEndpointReturnsFailure()
    {
        var handler = new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));

        var client = new HttpClient(handler);

        var healthCheck = new StripeHealthCheck(client);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Degraded, result.Status);
        Assert.Equal("Stripe returned an error.", result.Description);
    }

    [Fact]
    public async Task DatabricksAiHealthCheck_ReturnsDegraded_WhenConfigurationIncomplete()
    {
        
        var config = CreateDatabricksConfiguration(
            workspaceUrl: "",
            accessToken: "",
            endpointName: "");

        var httpClientFactory = new Mock<IHttpClientFactory>();

        var healthCheck = new DatabricksAiHealthCheck(
            config,
            httpClientFactory.Object);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Degraded, result.Status);
        Assert.Equal(
            "Databricks AI configuration incomplete.",
            result.Description);
    }

    [Fact]
    public async Task DatabricksAiHealthCheck_ReturnsHealthy_WhenEndpointReturnsSuccess()
    {
        var config = CreateDatabricksConfiguration();

        var handler = new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK));

        var client = new HttpClient(handler);

        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory
            .Setup(factory => factory.CreateClient(It.IsAny<string>()))
            .Returns(client);

        var healthCheck = new DatabricksAiHealthCheck(
            config,
            httpClientFactory.Object);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Healthy, result.Status);
        Assert.Equal(
            "Databricks serving endpoint available.",
            result.Description);
    }

   [Fact]
    public async Task DatabricksAiHealthCheck_ReturnsDegraded_WhenEndpointReturnsFailure()
    {
        var config = CreateDatabricksConfiguration();

        var handler = new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError));

        var client = new HttpClient(handler);

        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory
            .Setup(factory => factory.CreateClient(It.IsAny<string>()))
            .Returns(client);

        var healthCheck = new DatabricksAiHealthCheck(
            config,
            httpClientFactory.Object);

        HealthCheckResult result =
            await healthCheck.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Degraded, result.Status);
        Assert.Equal(
            "Databricks returned 500",
            result.Description);
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public StubHttpMessageHandler(
            Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(_handler(request));
        }
    }
    private static IOptions<ConnectionStrings> CreateConnectionStrings(
        string postgres = "Host=test;Database=test",
        string communicationService = "Endpoint=test")
    {
        return Options.Create(new ConnectionStrings
        {
            PostgreSql = postgres,
            CommunicationService = communicationService
        });
    }

    private static IOptions<EmailConfiguration> CreateEmailConfiguration(
        string senderDisplayName = "Test Sender",
        bool useCustomDomain = false)
    {
        return Options.Create(new EmailConfiguration
        {
            SenderDisplayName = senderDisplayName,
            UseCustomDomain = useCustomDomain
        });
    }

    private static IOptions<DatabricksAiConfiguration>
        CreateDatabricksConfiguration(
            string workspaceUrl = "https://workspace",
            string accessToken = "token",
            string endpointName = "endpoint")
    {
        return Options.Create(new DatabricksAiConfiguration
        {
            WorkspaceUrl = workspaceUrl,
            AccessToken = accessToken,
            EndpointName = endpointName
        });
    }
}