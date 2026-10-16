namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Represents the current account setup completion state for a user.
/// Used to determine which setup step to redirect to after initial login.
/// </summary>
public class AccountSetupStatusDto
{
    public bool IsSetupComplete { get; init; }

    /// <summary>
    /// The route segment for the next incomplete step (e.g., "choose-subscription", "payment").
    /// Null when setup is complete.
    /// </summary>
    public string? CurrentStep { get; init; }

    public bool HasSubscription { get; init; }

    public bool HasPaymentMethod { get; init; }

    /// <summary>
    /// True when the tenant's subscription is paused (a no-card beta trial ended without a
    /// payment method). Setup is considered complete, but the account is locked until a
    /// payment method is added.
    /// </summary>
    public bool IsPaused { get; init; }

    /// <summary>
    /// True when the user must add a payment method to restore or keep access. Currently this
    /// mirrors <see cref="IsPaused"/>, but the two are kept as separate properties so future
    /// states (for example, a card required while still trialing) can diverge without a
    /// breaking contract change.
    /// </summary>
    public bool RequiresPaymentMethod { get; init; }

    public bool IsAdmin { get; init; }

    /// <summary>
    /// True when the user must (re-)accept at least one policy document before
    /// gaining full access. Aggregate of Terms of Service and Privacy Policy checks.
    /// </summary>
    public bool NeedsPolicyAcceptance { get; init; }

    /// <summary>
    /// True when the user's stored Terms of Service version does not match the current published version.
    /// </summary>
    public bool NeedsTermsOfServiceAcceptance { get; init; }

    /// <summary>
    /// True when the user's stored Privacy Policy version does not match the current published version.
    /// </summary>
    public bool NeedsPrivacyPolicyAcceptance { get; init; }

    /// <summary>
    /// Current published version date of the Terms of Service (ISO yyyy-MM-dd).
    /// </summary>
    public DateOnly LatestTermsOfServiceVersionDate { get; init; }

    /// <summary>
    /// Current published version date of the Privacy Policy (ISO yyyy-MM-dd).
    /// </summary>
    public DateOnly LatestPrivacyPolicyVersionDate { get; init; }
}
