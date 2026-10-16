namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Response returned after revoking a user session.
/// </summary>
public class RevokeSessionResponse
{
    /// <summary>
    /// Whether the revoked session belonged to the caller's current browser session.
    /// </summary>
    public required bool RevokedCurrentSession { get; init; }
}
