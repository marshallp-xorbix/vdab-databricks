namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// DTO representing a tenant invite (never includes the raw token).
/// </summary>
public class TenantInviteDto
{
    /// <summary>Invite identifier.</summary>
    public required Guid Id { get; init; }

    /// <summary>Tenant the invite belongs to.</summary>
    public required Guid TenantId { get; init; }

    /// <summary>Email address that was invited.</summary>
    public required string Email { get; init; }

    /// <summary>Lifecycle status (Pending, Accepted, Canceled, Expired).</summary>
    public required string Status { get; init; }

    /// <summary>UTC timestamp when the invite token expires.</summary>
    public required DateTime TokenExpiresAt { get; init; }

    /// <summary>UTC timestamp the invite was created.</summary>
    public required DateTime InvitedAt { get; init; }

    /// <summary>User id of the inviter.</summary>
    public required Guid InvitedByUserId { get; init; }

    /// <summary>Whether accepting this invite was flagged as requiring a seat purchase.</summary>
    public required bool RequiresSeatPurchase { get; init; }

    /// <summary>UTC timestamp the invite was accepted, if applicable.</summary>
    public DateTime? AcceptedAt { get; init; }
}
