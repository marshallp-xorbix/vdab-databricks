namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Request body for recording a user's acceptance of the current Terms of Service
/// and/or Privacy Policy versions.
/// </summary>
public class AcceptPoliciesRequest
{
    /// <summary>
    /// When true, stamp the current Terms of Service version and acceptance timestamp on the user.
    /// </summary>
    public bool AcceptTermsOfService { get; set; }

    /// <summary>
    /// When true, stamp the current Privacy Policy version and acceptance timestamp on the user.
    /// </summary>
    public bool AcceptPrivacyPolicy { get; set; }
}
