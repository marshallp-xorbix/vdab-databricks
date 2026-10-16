using System.Net.Http;
using System.Net.Http.Headers;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.HealthChecks;

public sealed class DatabricksAiHealthCheck : IHealthCheck
{
    private readonly DatabricksAiConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;

    public DatabricksAiHealthCheck(
        IOptions<DatabricksAiConfiguration> config,
        IHttpClientFactory httpClientFactory)
    {
        _config = config.Value;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_config.WorkspaceUrl) ||
            string.IsNullOrWhiteSpace(_config.AccessToken) ||
            string.IsNullOrWhiteSpace(_config.EndpointName))
        {
            return HealthCheckResult.Degraded(
                "Databricks AI configuration incomplete.");
        }

        HttpClient client =
            _httpClientFactory.CreateClient(
                DatabricksAiConfiguration.HttpClientName);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                _config.AccessToken);

        string url =
            $"{_config.WorkspaceUrl.TrimEnd('/')}/api/2.0/serving-endpoints/{_config.EndpointName}";

        try
        {
            HttpResponseMessage response =
                await client.GetAsync(url, cancellationToken);

            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy(
                    "Databricks serving endpoint available.")
                : HealthCheckResult.Degraded(
                    $"Databricks returned {(int)response.StatusCode}");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded(
                "Databricks serving endpoint unreachable.",
                ex);
        }
    }
}