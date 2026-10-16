using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

[ExcludeFromCodeCoverage]
public sealed class ConnectionStrings
{
    public const string ConfigurationSectionName = "ConnectionStrings";

    /// <summary>
    /// Connection-string name the Aspire AppHost injects the managed-container connection string under (as the
    /// environment variable <c>ConnectionStrings__AspireInjected</c>). Deliberately distinct from
    /// <see cref="PostgreSql"/> so the Server's startup promotion to <see cref="PostgreSql"/> reads as an
    /// explicit override rather than a same-name reshuffle. Only ever set when the app is launched by the
    /// AppHost in Aspire-managed-container mode.
    /// </summary>
    public const string AspireInjectedConnectionName = "AspireInjected";

    public required string PostgreSql { get; set; }

    public required string CommunicationService { get; set; }

    public string? ApplicationInsights { get; set; }
}
