using Microsoft.AspNetCore.Authentication;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

/// <summary>
/// Options for API key authentication.
/// </summary>
public class ApiKeyAuthenticationOptions : AuthenticationSchemeOptions
{
    /// <summary>
    /// Gets or sets the header name for the API key.
    /// </summary>
    public string ApiKeyHeaderName { get; set; } = "X-API-Key";
}