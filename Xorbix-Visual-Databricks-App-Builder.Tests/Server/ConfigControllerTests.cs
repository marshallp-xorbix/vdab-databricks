using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Config;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Tests for <see cref="ConfigController"/>, which serves runtime client configuration to the SPA.
/// </summary>
public class ConfigControllerTests
{
    private static ConfigController CreateController(
        string? applicationInsightsConnectionString,
        bool passwordlessOnly = false,
        int membershipReinstatementDays = 90)
    {
        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:ApplicationInsights"] = applicationInsightsConnectionString,
            })
            .Build();

        IOptions<AuthenticationConfiguration> authenticationOptions =
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = passwordlessOnly });
        IOptions<AccountLifecycleConfiguration> accountLifecycleOptions =
            Options.Create(new AccountLifecycleConfiguration
            {
                MembershipReinstatementDays = membershipReinstatementDays,
            });

        return new ConfigController(configuration, authenticationOptions, accountLifecycleOptions);
    }

    [Fact]
    public void GetClientConfig_WithConfiguredConnectionString_ReturnsConnectionString()
    {
        const string connectionString = "InstrumentationKey=test;IngestionEndpoint=https://example.test/";
        ConfigController controller = CreateController(connectionString);

        ActionResult<ClientConfigResponse> result = controller.GetClientConfig();

        OkObjectResult okResult = Assert.IsType<OkObjectResult>(result.Result);
        ClientConfigResponse response = Assert.IsType<ClientConfigResponse>(okResult.Value);
        Assert.Equal(connectionString, response.ApplicationInsightsConnectionString);
    }

    [Fact]
    public void GetClientConfig_WithNoConnectionString_ReturnsNull()
    {
        ConfigController controller = CreateController(null);

        ActionResult<ClientConfigResponse> result = controller.GetClientConfig();

        OkObjectResult okResult = Assert.IsType<OkObjectResult>(result.Result);
        ClientConfigResponse response = Assert.IsType<ClientConfigResponse>(okResult.Value);
        Assert.Null(response.ApplicationInsightsConnectionString);
    }

    [Fact]
    public void GetClientConfig_WhenPasswordlessOnlyEnabled_ReturnsPasswordlessOnlyTrue()
    {
        ConfigController controller = CreateController(null, passwordlessOnly: true);

        ActionResult<ClientConfigResponse> result = controller.GetClientConfig();

        OkObjectResult okResult = Assert.IsType<OkObjectResult>(result.Result);
        ClientConfigResponse response = Assert.IsType<ClientConfigResponse>(okResult.Value);
        Assert.True(response.PasswordlessOnly);
    }

    [Fact]
    public void GetClientConfig_WhenPasswordlessOnlyDisabled_ReturnsPasswordlessOnlyFalse()
    {
        ConfigController controller = CreateController(null, passwordlessOnly: false);

        ActionResult<ClientConfigResponse> result = controller.GetClientConfig();

        OkObjectResult okResult = Assert.IsType<OkObjectResult>(result.Result);
        ClientConfigResponse response = Assert.IsType<ClientConfigResponse>(okResult.Value);
        Assert.False(response.PasswordlessOnly);
    }

    [Fact]
    public void GetClientConfig_ReturnsMembershipReinstatementDays()
    {
        ConfigController controller = CreateController(null, membershipReinstatementDays: 45);

        ActionResult<ClientConfigResponse> result = controller.GetClientConfig();

        OkObjectResult okResult = Assert.IsType<OkObjectResult>(result.Result);
        ClientConfigResponse response = Assert.IsType<ClientConfigResponse>(okResult.Value);
        Assert.Equal(45, response.MembershipReinstatementDays);
    }
}
