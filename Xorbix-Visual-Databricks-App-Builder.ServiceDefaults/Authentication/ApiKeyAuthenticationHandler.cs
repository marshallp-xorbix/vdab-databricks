using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

/// <summary>
/// Authentication handler for API key authentication.
/// </summary>
public class ApiKeyAuthenticationHandler : AuthenticationHandler<ApiKeyAuthenticationOptions>
{
    private readonly IConfiguration _configuration;

    /// <summary>
    /// Initializes a new instance of the <see cref="ApiKeyAuthenticationHandler"/> class.
    /// </summary>
    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<ApiKeyAuthenticationOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IConfiguration configuration)
        : base(options, logger, encoder)
    {
        _configuration = configuration;
    }

    /// <inheritdoc/>
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(Options.ApiKeyHeaderName, out var apiKeyHeaderValues))
        {
            return AuthenticateResult.NoResult();
        }

        string providedApiKey = apiKeyHeaderValues.FirstOrDefault() ?? string.Empty;
        
        if (string.IsNullOrEmpty(providedApiKey))
        {
            return AuthenticateResult.NoResult();
        }

        // Validate API key (you should store these securely)
        string? validApiKey = _configuration["ApiKeys:ServiceKey"];
        
        if (providedApiKey != validApiKey)
        {
            return AuthenticateResult.Fail("Invalid API Key");
        }

        // Create claims for the API key user
        List<Claim> claims =
        [
            new Claim(ClaimTypes.NameIdentifier, "api-key-user"),
            new Claim(ClaimTypes.Name, "API Key User"),
            new Claim("AuthenticationType", "ApiKey")
        ];

        ClaimsIdentity identity = new(claims, Scheme.Name);
        ClaimsPrincipal principal = new(identity);
        AuthenticationTicket ticket = new(principal, Scheme.Name);

        return await Task.FromResult(AuthenticateResult.Success(ticket));
    }
}