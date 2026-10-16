using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

[ExcludeFromCodeCoverage]
public sealed class DatabricksAiConfiguration
{
    public const string ConfigurationSectionName = "DatabricksAi";
    public const string HttpClientName = "DatabricksAiClient";

    /// <summary>Default per-request timeout for AI Gateway chat completions (tool-calling can be slow).</summary>
    public const int DefaultTimeoutSeconds = 180;

    public string WorkspaceUrl { get; set; } = string.Empty;

    /// <summary>The Model Serving endpoint name configured in Databricks.</summary>
    public string EndpointName { get; set; } = string.Empty;

    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// Maximum seconds for a single AI Gateway HTTP request (one chat-completion round).
    /// Overrides Aspire's standard resilience default of 30 seconds for this client.
    /// </summary>
    public int TimeoutSeconds { get; set; } = DefaultTimeoutSeconds;
}
