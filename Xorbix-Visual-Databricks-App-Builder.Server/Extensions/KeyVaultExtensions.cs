using Azure.Core;
using Azure.Extensions.AspNetCore.Configuration.Secrets;
using Azure.Identity;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Extensions;

/// <summary>
/// Registers Azure Key Vault as a configuration provider so secrets are injected
/// into <see cref="IConfiguration"/> and override values from appsettings files.
/// </summary>
public static class KeyVaultExtensions
{
    /// <summary>
    /// Creates the credential used for Azure Key Vault operations.
    /// <para>
    /// Authentication priority:
    /// <list type="number">
    ///   <item>Explicit Service Principal — <c>KeyVault:TenantId</c>, <c>ClientId</c>, <c>ClientSecret</c></item>
    ///   <item><see cref="DefaultAzureCredential"/> — Visual Studio, Azure CLI, Managed Identity, etc.</item>
    /// </list>
    /// </para>
    /// </summary>
    /// <param name="builder">The web application builder.</param>
    /// <param name="logger">Optional logger for startup authentication details.</param>
    /// <returns>The credential to use for Key Vault and related Azure integrations.</returns>
    public static TokenCredential CreateKeyVaultCredential(this WebApplicationBuilder builder, ILogger? logger = null)
    {
        var configuration = builder.Configuration;

        var tenantId = configuration["KeyVault:TenantId"];
        var clientId = configuration["KeyVault:ClientId"];
        var clientSecret = configuration["KeyVault:ClientSecret"];

        if (!string.IsNullOrEmpty(tenantId)
            && !string.IsNullOrEmpty(clientId)
            && !string.IsNullOrEmpty(clientSecret))
        {
            logger?.LogInformation("Using explicit Service Principal authentication for Key Vault.");
            return new ClientSecretCredential(tenantId, clientId, clientSecret);
        }

        logger?.LogInformation("Using DefaultAzureCredential for Key Vault.");
        return new DefaultAzureCredential();
    }

    /// <summary>
    /// Adds Azure Key Vault as a configuration source when <c>KeyVault:Uri</c> is present.
    /// </summary>
    /// <param name="builder">The web application builder.</param>
    /// <param name="credential">The credential used to authenticate with Key Vault.</param>
    /// <returns>The same <see cref="WebApplicationBuilder"/> instance for chaining.</returns>
    public static WebApplicationBuilder AddAzureKeyVaultConfiguration(this WebApplicationBuilder builder, TokenCredential credential)
    {
        var keyVaultUri = builder.Configuration["KeyVault:Uri"];

        if (string.IsNullOrEmpty(keyVaultUri))
        {
            return builder;
        }

        builder.Configuration.AddAzureKeyVault(new Uri(keyVaultUri), credential);

        return builder;
    }

    /// <summary>
    /// Adds Azure Key Vault as a configuration source when <c>KeyVault:Uri</c> is present.
    /// <para>
    /// Authentication priority:
    /// <list type="number">
    ///   <item>Explicit Service Principal — <c>KeyVault:TenantId</c>, <c>ClientId</c>, <c>ClientSecret</c></item>
    ///   <item><see cref="DefaultAzureCredential"/> — Visual Studio, Azure CLI, Managed Identity, etc.</item>
    /// </list>
    /// </para>
    /// </summary>
    /// <param name="builder">The web application builder.</param>
    /// <returns>The same <see cref="WebApplicationBuilder"/> instance for chaining.</returns>
    public static WebApplicationBuilder AddAzureKeyVaultConfiguration(this WebApplicationBuilder builder)
    {
        var credential = builder.CreateKeyVaultCredential();

        return builder.AddAzureKeyVaultConfiguration(credential);
    }
}