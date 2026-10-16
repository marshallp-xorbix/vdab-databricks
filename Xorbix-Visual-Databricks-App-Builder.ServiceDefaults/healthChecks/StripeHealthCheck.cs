using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Xorbix_Visual_Databricks_App_Builder.HealthChecks;

public class StripeHealthCheck : IHealthCheck
{
    private const string StripeUrl = "https://api.stripe.com/healthcheck";
    private readonly HttpClient _httpClient;

    public StripeHealthCheck(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(5);
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using HttpResponseMessage response = await _httpClient.GetAsync(
                StripeUrl,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return HealthCheckResult.Degraded("Stripe returned an error.");
            }
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Stripe API unavailable.", ex);
        }

        return HealthCheckResult.Healthy();
    }
}
