using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

[ExcludeFromCodeCoverage]
public sealed class DebugConfiguration
{
    public const string ConfigurationSectionName = "Debug";

    public bool ForceAllEmailsToDebugRecipient { get; init; }

    public string DebugEmailRecipient { get; init; } = string.Empty;

    public bool Skip2FA { get; init; }
}
