namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Public response payload returned when validating an invite token (pre-acceptance).
/// </summary>
public class InviteValidationResponse
{
    /// <summary>Whether the token corresponds to a valid (Pending, non-expired) invite.</summary>
    public required bool IsValid { get; init; }

    /// <summary>Email the invite was issued to (only when valid).</summary>
    public string? Email { get; init; }

    /// <summary>Display name of the inviting tenant (only when valid).</summary>
    public string? TenantDisplayName { get; init; }

    /// <summary>The ID of the inviting tenant (only when valid).</summary>
    public Guid? TenantId { get; init; }

    /// <summary>UTC token expiry (only when valid).</summary>
    public DateTime? TokenExpiresAt { get; init; }

    /// <summary>
    /// Whether a user account already exists for the invited email (only when valid).
    /// Drives the UI decision between "redirect to login" vs "create account and accept".
    /// </summary>
    public bool? UserExists { get; init; }

    /// <summary>Reason the token is invalid (only when not valid). Examples: "Expired", "NotFound", "AlreadyAccepted", "Canceled".</summary>
    public string? Reason { get; init; }
}
