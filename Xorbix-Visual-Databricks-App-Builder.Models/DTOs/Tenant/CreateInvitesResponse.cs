namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Result outcome for a single email submitted via the batch-invite endpoint.
/// </summary>
public enum InviteOutcome
{
    /// <summary>A new pending invite was created.</summary>
    Created = 0,

    /// <summary>An identical pending invite already existed for this email/tenant.</summary>
    AlreadyPending = 1,

    /// <summary>The email is already a member of the tenant.</summary>
    AlreadyMember = 2,

    /// <summary>The email failed validation (malformed, empty, etc.).</summary>
    Invalid = 3,

    /// <summary>
    /// A live Detached account previously belonged to this tenant. No invite is created
    /// until the admin confirms Re-add vs Different person (§11.1).
    /// Reveals that the address has a VDAB account (accepted deliberately).
    /// </summary>
    PriorMemberChoiceRequired = 4,
}

/// <summary>
/// Admin choice when inviting an email that matches a prior Detached member (§11.1).
/// </summary>
public enum PriorMemberChoice
{
    /// <summary>Restore the soft-deleted membership with role intact.</summary>
    ReAdd = 0,

    /// <summary>Retire the old account and send a normal invite for a new person.</summary>
    DifferentPerson = 1,
}

/// <summary>
/// Prompt payload when <see cref="InviteOutcome.PriorMemberChoiceRequired"/> is returned.
/// </summary>
public class PriorMemberPromptDto
{
    /// <summary>Display name of the prior member.</summary>
    public required string DisplayName { get; init; }

    /// <summary>Email address being invited.</summary>
    public required string Email { get; init; }

    /// <summary>When the membership was soft-deleted.</summary>
    public required DateTime RemovedOn { get; init; }

    /// <summary>Role on the soft-deleted membership.</summary>
    public required string PriorRole { get; init; }

    /// <summary>
    /// True when Different person is allowed (<c>LastLoginAt</c> is null or before <see cref="RemovedOn"/>).
    /// </summary>
    public required bool AllowDifferentPerson { get; init; }

    /// <summary>
    /// True when the account also has ended memberships in other tenants (warning only).
    /// </summary>
    public required bool OtherTenantsHaveEndedMemberships { get; init; }
}

/// <summary>
/// Per-email result inside a <see cref="CreateInvitesResponse"/>.
/// </summary>
public class InviteResultDto
{
    /// <summary>Original email as supplied (post-trim).</summary>
    public required string Email { get; init; }

    /// <summary>Outcome classification for the email.</summary>
    public required InviteOutcome Outcome { get; init; }

    /// <summary>The resulting invite (only populated when <see cref="Outcome"/> is Created or AlreadyPending).</summary>
    public TenantInviteDto? Invite { get; init; }

    /// <summary>Optional human-readable detail (e.g., validation message).</summary>
    public string? Message { get; init; }

    /// <summary>Populated when <see cref="Outcome"/> is <see cref="InviteOutcome.PriorMemberChoiceRequired"/>.</summary>
    public PriorMemberPromptDto? PriorMember { get; init; }
}

/// <summary>
/// Response payload for batch invite creation.
/// </summary>
public class CreateInvitesResponse
{
    /// <summary>Per-email results in the same order they were submitted.</summary>
    public required IList<InviteResultDto> Results { get; init; }

    /// <summary>
    /// Number of new invites that, if all accepted, would exceed currently available
    /// (unassigned) seats. Surfaced so the UI can warn the inviter that additional
    /// seats may need to be purchased before acceptance.
    /// </summary>
    public required int SeatOverageCount { get; init; }

    /// <summary>Total available (unassigned, active) seats at the time of invite creation.</summary>
    public required int AvailableSeats { get; init; }
}
