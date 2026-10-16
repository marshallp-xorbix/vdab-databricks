using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

[ExcludeFromCodeCoverage]
public sealed class ApplicationConfiguration
{
    public const string ConfigurationSectionName = "ApplicationConfiguration";
    public const string CorsAllowAll = "AllowAll";
    public const string CorsDefault = "CorsDefault";

    public required string AllowedOrigins { get; set; }
    public required string FrontendUrl { get; set; }
}
