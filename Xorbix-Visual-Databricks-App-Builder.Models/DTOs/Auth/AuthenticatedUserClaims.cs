using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

/// <summary>
/// Represents the authenticated user's JWT claims extracted from the current request context. Extends UserInfo to include JWT-specific claims.
/// </summary>
public class AuthenticatedUserClaims : UserInfo
{
    /// <summary>
    /// Gets or sets the JWT ID (unique identifier for this token).
    /// </summary>
    public string? Jti { get; init; }

    /// <summary>
    /// Gets or sets the issued-at timestamp (Unix epoch seconds).
    /// </summary>
    public long? IssuedAt { get; init; }

    /// <summary>Current tenant ID from the <c>tenant_id</c> claim.</summary>
    public Guid? TenantId { get; init; }

    /// <summary>Tenant role from the <c>tenant_role</c> claim.</summary>
    public string? TenantRole { get; init; }

}
