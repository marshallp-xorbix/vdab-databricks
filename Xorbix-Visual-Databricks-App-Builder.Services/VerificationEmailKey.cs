namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Canonicalizes an email into the key form used for verification-flow cache entries. The issuance
/// throttle, the per-code slot, and the attempt budget must all key on the identical string, or a
/// whitespace/case variant of one address could land in one bucket yet a separate slot in another.
/// Sharing this one normalizer keeps the three from drifting if the canonical form ever changes.
/// </summary>
internal static class VerificationEmailKey
{
    /// <summary>Returns the canonical cache-key form of <paramref name="email"/>.</summary>
    /// <param name="email">The submitted email address.</param>
    public static string Normalize(string email) => email.Trim().ToLowerInvariant();
}
