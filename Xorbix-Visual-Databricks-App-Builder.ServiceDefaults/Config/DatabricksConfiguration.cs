using System.Diagnostics.CodeAnalysis;
using System.Reflection;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

[ExcludeFromCodeCoverage]
public sealed class DatabricksConfiguration
{
    public const string ConfigurationSectionName = "DatabricksConfiguration";
    public const string HttpClientName = "DatabricksClient";

    /// <summary>
    /// Default partner User-Agent following Databricks ISV format: partner_name/version.
    /// Uses underscore separator per Databricks partner telemetry requirements.
    /// </summary>
    private static readonly string DefaultUserAgent =
        $"Xorbix_VisualDataAppBuilder/{Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0"}";

    public int TimeoutSeconds { get; set; } = 30;
    public string UserAgent { get; set; } = DefaultUserAgent;
}
