using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configuration for fetching public legal page content from the VDAB WordPress marketing site.
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class WordPressConfiguration
{
    public const string ConfigurationSectionName = "WordPressConfiguration";
    public const string HttpClientName = "WordPressClient";

    /// <summary>
    /// Default base URL of the WordPress marketing site.
    /// </summary>
    public const string DefaultBaseUrl = "https://vdab.ai";

    /// <summary>
    /// Base URL of the WordPress site (e.g. https://vdab.ai).
    /// </summary>
    public string BaseUrl { get; init; } = DefaultBaseUrl;

    /// <summary>
    /// HTTP timeout for WordPress REST requests.
    /// </summary>
    public int TimeoutSeconds { get; init; } = 30;

    /// <summary>
    /// How long sanitized legal page content is cached.
    /// </summary>
    public int CacheSeconds { get; init; } = 300;

    /// <summary>
    /// WordPress page slug for Terms and Conditions.
    /// </summary>
    public string TermsOfServiceSlug { get; init; } = "terms-and-conditions";

    /// <summary>
    /// WordPress page slug for the Privacy Policy.
    /// </summary>
    public string PrivacyPolicySlug { get; init; } = "privacy-policy";
}
