using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ServiceDefaults;

public class HealthCheckRegistrationTests
{
    [Fact]
    public void AddDefaultHealthChecks_RegistersExpectedSystemChecks()
    {
        HostApplicationBuilder builder = Host.CreateApplicationBuilder();

        builder.AddDefaultHealthChecks();

        using ServiceProvider provider = builder.Services.BuildServiceProvider();
        HealthCheckServiceOptions options = provider
            .GetRequiredService<IOptions<HealthCheckServiceOptions>>()
            .Value;

        List<string> names = options.Registrations
            .Select(registration => registration.Name)
            .ToList();

        Assert.Contains("self", names);
        Assert.Contains("Stripe", names);
        Assert.Contains("Postgres", names);
        Assert.Contains("EmailService", names);
        Assert.Contains("DatabricksAi", names);
    }
}
