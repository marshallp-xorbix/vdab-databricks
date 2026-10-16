using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service contract for managing tenant invitations (Phase 3 backend slice).
/// </summary>
public interface ITenantInviteService
{
    /// <summary>
    /// Lists pending invites for the given tenant.
    /// </summary>
    Task<Result<IList<TenantInviteDto>>> ListPendingAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a batch of invites for the given tenant. Existing memberships and pending invites
    /// are deduplicated; results are reported per email. When an email matches a Detached prior
    /// member of this tenant, returns <see cref="InviteOutcome.PriorMemberChoiceRequired"/> without
    /// creating an invite until <see cref="ConfirmPriorMemberChoiceAsync"/> is called (invite UI
    /// confirms restore / ReAdd only).
    /// </summary>
    Task<Result<CreateInvitesResponse>> CreateInvitesAsync(
        Guid tenantId,
        IEnumerable<string> emails,
        Guid invitedByUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirms Re-add (restore membership) or Different person (retire + new invite) for a prior
    /// Detached member. The tenant invite UI currently confirms ReAdd only; DifferentPerson is
    /// retained for a future support/admin path and is not offered in that dialog.
    /// </summary>
    Task<Result<PriorMemberChoiceResponse>> ConfirmPriorMemberChoiceAsync(
        Guid tenantId,
        string email,
        PriorMemberChoice choice,
        Guid actingUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels a pending invite. Returns NotFound if the invite does not belong to the tenant.
    /// </summary>
    Task<Result> CancelInviteAsync(Guid tenantId, Guid inviteId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resends an invite (re-issues a fresh token + extends expiry). Email delivery itself
    /// is wired up in Phase 4; the service updates state regardless.
    /// </summary>
    Task<Result<TenantInviteDto>> ResendInviteAsync(Guid tenantId, Guid inviteId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates a raw invite token (used by the public landing page before sign-in/sign-up).
    /// </summary>
    Task<Result<InviteValidationResponse>> ValidateTokenAsync(string token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Accepts an invite for the authenticated user. Creates the tenant membership, assigns an
    /// available seat when one exists, marks the invite accepted, and sets the user's default
    /// tenant when one has not been set previously.
    /// </summary>
    Task<Result> AcceptInviteAsync(string token, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new user for an invitee who does not yet have an account and accepts the
    /// invite in a single atomic operation. Used when the invite link lands on a visitor
    /// who has no existing account. Clicking the invite link proves email ownership, so the
    /// new user is created with <c>EmailConfirmed=true</c> and no welcome or confirmation
    /// emails are sent. In passwordless-only mode the user is provisioned without a password and
    /// the returned <see cref="RegisterAndAcceptInviteResponse.AuthResponse"/> carries tokens for
    /// immediate sign-in; in password-based mode a password is required and no tokens are issued.
    /// </summary>
    /// <param name="request">The registration + invite acceptance request.</param>
    /// <param name="ipAddress">The client's IP address, recorded against any session issued on acceptance.</param>
    /// <param name="userAgent">The client's User-Agent, recorded against any session issued on acceptance.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task<Result<RegisterAndAcceptInviteResponse>> RegisterAndAcceptInviteAsync(
        RegisterAndAcceptInviteRequest request,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default);
}
