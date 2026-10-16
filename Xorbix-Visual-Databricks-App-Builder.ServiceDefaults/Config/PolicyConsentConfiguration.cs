using System;
using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

/// <summary>
/// Configuration for the current published versions of the Terms of Service
/// and Privacy Policy. Users whose stored consented version dates do not match
/// these values must re-accept the corresponding document before gaining full
/// access to the application.
/// </summary>
[ExcludeFromCodeCoverage]
public sealed class PolicyConsentConfiguration
{
    public const string ConfigurationSectionName = "PolicyConsentConfiguration";

    /// <summary>
    /// Current published version date of the Terms of Service. Stored on the
    /// user record when they accept.
    /// </summary>
    public DateOnly TermsOfServiceVersionDate { get; init; }

    /// <summary>
    /// Current published version date of the Privacy Policy. Stored on the
    /// user record when they accept.
    /// </summary>
    public DateOnly PrivacyPolicyVersionDate { get; init; }
}
