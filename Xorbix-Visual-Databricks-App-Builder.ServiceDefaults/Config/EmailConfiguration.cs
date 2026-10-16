using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configuration for Email SErvice.
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class EmailConfiguration
{
    public const string ConfigurationSectionName = "EmailConfiguration";
    public required bool UseCustomDomain { get; init; }
    public required string SenderDisplayName { get; init; }

    public EmailDomainConfiguration CustomDomain { get; init; } = new EmailDomainConfiguration();

    public EmailDomainConfiguration AzureManagedDomain { get; init; } = new EmailDomainConfiguration();

}

public sealed class EmailDomainConfiguration
{
    public const string ConfigurationSectionName = "DomainConfiguration";
    public string Domain { get; init; } = string.Empty;
    public string SenderUsername { get; init; } = string.Empty;
}