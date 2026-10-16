namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Determines whether a user must (re-)accept a published policy document based on
/// the stored version date, acceptance timestamp, and current configured version.
/// </summary>
public static class PolicyConsentEvaluator
{
    /// <summary>
    /// Returns true when the user must accept the current Terms of Service version.
    /// </summary>
    /// <param name="storedVersion">Version date the user last accepted, if any.</param>
    /// <param name="acceptedOnUtc">UTC timestamp when the user accepted the stored version, if any.</param>
    /// <param name="currentVersion">Current published version date from configuration.</param>
    public static bool RequiresTermsOfServiceAcceptance(
        DateOnly? storedVersion,
        DateTime? acceptedOnUtc,
        DateOnly currentVersion)
    {
        return RequiresPolicyAcceptance(storedVersion, acceptedOnUtc, currentVersion);
    }

    /// <summary>
    /// Returns true when the user must accept the current Privacy Policy version.
    /// </summary>
    /// <param name="storedVersion">Version date the user last accepted, if any.</param>
    /// <param name="acceptedOnUtc">UTC timestamp when the user accepted the stored version, if any.</param>
    /// <param name="currentVersion">Current published version date from configuration.</param>
    public static bool RequiresPrivacyPolicyAcceptance(
        DateOnly? storedVersion,
        DateTime? acceptedOnUtc,
        DateOnly currentVersion)
    {
        return RequiresPolicyAcceptance(storedVersion, acceptedOnUtc, currentVersion);
    }

    /// <summary>
    /// Returns true when the stored consent is missing, outdated, or inconsistent with
    /// the current published version.
    /// </summary>
    public static bool RequiresPolicyAcceptance(
        DateOnly? storedVersion,
        DateTime? acceptedOnUtc,
        DateOnly currentVersion)
    {
        if (storedVersion != currentVersion)
        {
            return true;
        }

        if (!acceptedOnUtc.HasValue)
        {
            return true;
        }

        DateOnly acceptedDate = DateOnly.FromDateTime(acceptedOnUtc.Value);
        return acceptedDate < currentVersion;
    }
}
