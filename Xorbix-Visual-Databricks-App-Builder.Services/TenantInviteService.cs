using System.Diagnostics.CodeAnalysis;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Transactions;
using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for tenant invitations: creation, validation, acceptance, cancellation,
/// resends, and post-registration auto-accept. Email delivery uses
/// <see cref="IEmailSenderService"/>; membership + seat assignment are performed
/// inside a <see cref="TransactionScope"/> for atomicity.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="TenantInviteService"/> class.
/// </remarks>
[SuppressMessage("Major Code Smell", "S107:Methods should not have too many parameters", Justification = "Service coordinates invite, tenant, membership, seat, email, and identity subsystems; grouping would obscure DI graph.")]
public class TenantInviteService(
    ILogger<TenantInviteService> _logger,
    ITenantInviteRepository _tenantInviteRepository,
    ITenantRepository _tenantRepository,
    IUserTenantMembershipRepository _userTenantMembershipRepository,
    IUserTenantMembershipService _userTenantMembershipService,
    ISeatManagementService _seatManagementService,
    ISubscriptionTierService _subscriptionTierService,
    IInternalDevTenantService _internalDevTenantService,
    ISubscriptionSeatRepository _subscriptionSeatRepository,
    IEmailSenderService _emailSender,
    UserManager<ApplicationUser> _userManager,
    IUserProvisioningService _userProvisioningService,
    IAuthResponseService _authResponseService,
    IUserService _userService,
    IOptions<TenantInviteConfiguration> _inviteOptions,
    IOptions<AuthenticationConfiguration> _authenticationOptions) : ITenantInviteService
{
    private const int TokenByteLength = 32;
    private const string DefaultInviteRole = AuthRoles.Developer;

    /// <inheritdoc/>
    public async Task<Result<IList<TenantInviteDto>>> ListPendingAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            IEnumerable<TenantInvite> invites = await _tenantInviteRepository.GetPendingByTenantAsync(tenantId, cancellationToken);
            List<TenantInviteDto> dtos = invites.Select(MapToDto).ToList();
            return Result.Ok<IList<TenantInviteDto>>(dtos);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list pending invites for tenant {TenantId}", tenantId);
            return Result.Fail<IList<TenantInviteDto>>("Failed to list invites.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<CreateInvitesResponse>> CreateInvitesAsync(
        Guid tenantId,
        IEnumerable<string> emails,
        Guid invitedByUserId,
        CancellationToken cancellationToken = default)
    {
        return await CreateInvitesAsync(
            tenantId,
            emails,
            invitedByUserId,
            skipPriorMemberPrompt: false,
            cancellationToken);
    }

    /// <summary>
    /// Creates invites, optionally skipping the prior-member confirmation gate
    /// (used when confirming restore-via-invite for a known prior member).
    /// When <paramref name="pendingEmailDispatch"/> is provided, invite emails are not
    /// dispatched here; the caller must dispatch after its outer transaction commits.
    /// </summary>
    private async Task<Result<CreateInvitesResponse>> CreateInvitesAsync(
        Guid tenantId,
        IEnumerable<string> emails,
        Guid invitedByUserId,
        bool skipPriorMemberPrompt,
        CancellationToken cancellationToken,
        List<(TenantInvite Invite, string RawToken)>? pendingEmailDispatch = null)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (tenant == null)
            {
                return Result.Fail<CreateInvitesResponse>(new NotFoundError($"Tenant '{tenantId}' not found."));
            }

            TenantInviteConfiguration config = _inviteOptions.Value;
            List<string> rawEmails = emails?.ToList() ?? [];
            if (rawEmails.Count == 0)
            {
                return Result.Fail<CreateInvitesResponse>(new BadRequestError("At least one email must be provided."));
            }

            if (rawEmails.Count > config.MaxBatchSize)
            {
                return Result.Fail<CreateInvitesResponse>(
                    new BadRequestError($"Cannot invite more than {config.MaxBatchSize} addresses at once."));
            }

            Result<SeatSummaryDto> seatResult = await _seatManagementService.GetSeatSummaryAsync(tenantId, cancellationToken);
            if (seatResult.IsFailed)
            {
                return Result.Fail<CreateInvitesResponse>(seatResult.Errors);
            }

            // Complimentary allowlisted tenants never mark invites as paid overage;
            // keep SeatSummaryDto.AvailableSeats honest for UI/API consumers.
            int availableSeats = _internalDevTenantService.IsInternalDevTenant(tenantId)
                ? int.MaxValue
                : seatResult.Value.AvailableSeats;
            int seatsClaimed = 0;

            List<InviteResultDto> results = [];
            List<(TenantInvite Invite, string RawToken)> toInsert = [];
            HashSet<string> seenInBatch = new(StringComparer.Ordinal);
            EvaluationContext context = new(
                tenantId,
                invitedByUserId,
                config,
                availableSeats,
                seenInBatch,
                toInsert,
                skipPriorMemberPrompt);

            foreach (string rawEmail in rawEmails)
            {
                InviteResultDto result = await EvaluateEmailAsync(rawEmail, context, seatsClaimed, cancellationToken);

                results.Add(result);
                if (result.Outcome == InviteOutcome.Created)
                {
                    seatsClaimed++;
                }
            }

            if (toInsert.Count > 0)
            {
                await _tenantInviteRepository.AddRangeAsync(toInsert.Select(t => t.Invite), cancellationToken);

                if (pendingEmailDispatch is not null)
                {
                    pendingEmailDispatch.AddRange(toInsert);
                }
                else
                {
                    // Email delivery runs in the background after the write succeeds. The
                    // provider waits for full delivery (WaitUntil.Completed), which can take
                    // tens of seconds; awaiting it here would block the response long enough
                    // for the client to time out even though the invites are already saved.
                    // Failures are logged via SendInviteEmailSafeAsync so the admin can resend.
                    string inviterName = await GetDisplayNameAsync(invitedByUserId);
                    DispatchInviteEmailsInBackground(toInsert, tenant.DisplayName, inviterName);
                }
            }

            int seatOverage = Math.Max(0, seatsClaimed - availableSeats);

            return Result.Ok(new CreateInvitesResponse
            {
                Results = results,
                SeatOverageCount = seatOverage,
                AvailableSeats = availableSeats,
            });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create invites for tenant {TenantId}", tenantId);
            return Result.Fail<CreateInvitesResponse>("Failed to create invites.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<PriorMemberChoiceResponse>> ConfirmPriorMemberChoiceAsync(
        Guid tenantId,
        string email,
        PriorMemberChoice choice,
        Guid actingUserId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            string trimmed = (email ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(trimmed) || !IsValidEmail(trimmed))
            {
                return Result.Fail(new BadRequestError("Email is missing or malformed."));
            }

            ApplicationUser? existingUser = await _userManager.FindByEmailAsync(trimmed);
            if (existingUser is null || existingUser.DeletedOn is not null)
            {
                return Result.Fail(new NotFoundError("No live prior member was found for this email."));
            }

            if (await _userTenantMembershipRepository.ExistsAsync(existingUser.Id, tenantId, cancellationToken))
            {
                return Result.Fail(new ConflictError("User is already an active member of this tenant."));
            }

            UserTenantMembership? priorMembership =
                await _userTenantMembershipRepository.GetSoftDeletedByUserAndTenantAsync(
                    existingUser.Id,
                    tenantId,
                    cancellationToken);
            if (priorMembership?.DeletedOn is null)
            {
                return Result.Fail(new NotFoundError("No removed membership found for this email in the current tenant."));
            }

            bool allowDifferentPerson = existingUser.LastLoginAt is null
                || existingUser.LastLoginAt < priorMembership.DeletedOn;

            if (choice == PriorMemberChoice.ReAdd)
            {
                Result windowCheck = _userTenantMembershipService.EnsureWithinReinstatementWindow(priorMembership);
                if (windowCheck.IsFailed)
                {
                    return Result.Fail(windowCheck.Errors);
                }

                // Restore is invite-gated: send a pending invite; membership reactivates on accept.
                Result<CreateInvitesResponse> reinviteResult = await CreateInvitesAsync(
                    tenantId,
                    [trimmed],
                    actingUserId,
                    skipPriorMemberPrompt: true,
                    cancellationToken);
                if (reinviteResult.IsFailed)
                {
                    return Result.Fail(reinviteResult.Errors);
                }

                InviteResultDto? created = reinviteResult.Value.Results.FirstOrDefault();
                if (created is null
                    || (created.Outcome != InviteOutcome.Created
                        && created.Outcome != InviteOutcome.AlreadyPending))
                {
                    return Result.Fail(new BadRequestError(
                        created?.Message ?? "Failed to create a restore invite for this prior member."));
                }

                return Result.Ok(new PriorMemberChoiceResponse
                {
                    Choice = PriorMemberChoice.ReAdd,
                    InviteResponse = reinviteResult.Value,
                });
            }

            if (choice != PriorMemberChoice.DifferentPerson)
            {
                return Result.Fail(new BadRequestError("Unsupported prior-member choice."));
            }

            if (!allowDifferentPerson)
            {
                return Result.Fail(new ForbiddenError(
                    "This account signed in after it was removed. Contact support to invite a different person at this address."));
            }

            // Outer scope so SoftDelete + invite create commit together; SoftDelete's
            // inner Required scope joins ambient. Capture invites and dispatch email only
            // after the scope is disposed so a rolled-back token is never emailed.
            List<(TenantInvite Invite, string RawToken)> pendingEmails = [];
            CreateInvitesResponse inviteResponse;
            using (TransactionScope transaction = new(TransactionScopeAsyncFlowOption.Enabled))
            {
                Result retireResult = await _userService.SoftDeleteUserAsync(existingUser.Id, actingUserId, cancellationToken);
                if (retireResult.IsFailed)
                {
                    return Result.Fail(retireResult.Errors);
                }

                Result<CreateInvitesResponse> inviteResult = await CreateInvitesAsync(
                    tenantId,
                    [trimmed],
                    actingUserId,
                    skipPriorMemberPrompt: false,
                    cancellationToken,
                    pendingEmails);
                if (inviteResult.IsFailed)
                {
                    return Result.Fail(inviteResult.Errors);
                }

                transaction.Complete();
                inviteResponse = inviteResult.Value;
            }

            if (pendingEmails.Count > 0)
            {
                Tenant? tenantForEmail = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
                string inviterNameForEmail = await GetDisplayNameAsync(actingUserId);
                DispatchInviteEmailsInBackground(
                    pendingEmails,
                    tenantForEmail?.DisplayName ?? "Workspace",
                    inviterNameForEmail);
            }

            return Result.Ok(new PriorMemberChoiceResponse
            {
                Choice = PriorMemberChoice.DifferentPerson,
                InviteResponse = inviteResponse,
            });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to confirm prior-member choice for tenant {TenantId}", tenantId);
            return Result.Fail(new ExceptionalError("Failed to confirm prior-member choice.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> CancelInviteAsync(Guid tenantId, Guid inviteId, Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            TenantInvite? invite = await _tenantInviteRepository.GetByIdAsync(inviteId, cancellationToken);
            if (invite == null || invite.TenantId != tenantId)
            {
                return Result.Fail(new NotFoundError($"Invite '{inviteId}' not found."));
            }

            if (invite.Status != TenantInviteStatuses.Pending)
            {
                return Result.Fail(new BadRequestError($"Invite is not pending (status: {invite.Status})."));
            }

            invite.Status = TenantInviteStatuses.Canceled;
            invite.ModifiedBy = userId;
            invite.DeletedOn = DateTime.UtcNow;
            invite.DeletedBy = userId;
            await _tenantInviteRepository.UpdateAsync(invite, cancellationToken);

            return Result.Ok();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cancel invite {InviteId} for tenant {TenantId}", inviteId, tenantId);
            return Result.Fail("Failed to cancel invite.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<TenantInviteDto>> ResendInviteAsync(Guid tenantId, Guid inviteId, Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            TenantInvite? invite = await _tenantInviteRepository.GetByIdAsync(inviteId, cancellationToken);
            if (invite == null || invite.TenantId != tenantId)
            {
                return Result.Fail<TenantInviteDto>(new NotFoundError($"Invite '{inviteId}' not found."));
            }

            if (invite.Status != TenantInviteStatuses.Pending)
            {
                return Result.Fail<TenantInviteDto>(new BadRequestError($"Invite is not pending (status: {invite.Status})."));
            }

            (string rawToken, string tokenHash) = GenerateToken();
            invite.TokenHash = tokenHash;
            invite.TokenExpiresAt = DateTime.UtcNow.AddDays(_inviteOptions.Value.TokenExpirationDays);
            invite.ModifiedBy = userId;
            await _tenantInviteRepository.UpdateAsync(invite, cancellationToken);

            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            string tenantDisplayName = tenant?.DisplayName ?? "your organization";
            string inviterName = await GetDisplayNameAsync(userId);
            await SendInviteEmailSafeAsync(invite, rawToken, tenantDisplayName, inviterName, cancellationToken);

            return Result.Ok(MapToDto(invite));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to resend invite {InviteId} for tenant {TenantId}", inviteId, tenantId);
            return Result.Fail<TenantInviteDto>("Failed to resend invite.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<InviteValidationResponse>> ValidateTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return Result.Ok(new InviteValidationResponse { IsValid = false, Reason = "NotFound" });
            }

            string tokenHash = HashToken(token);
            TenantInvite? invite = await _tenantInviteRepository.GetByTokenHashAsync(tokenHash, cancellationToken);
            if (invite == null)
            {
                return Result.Ok(new InviteValidationResponse { IsValid = false, Reason = "NotFound" });
            }

            if (invite.Status == TenantInviteStatuses.Canceled)
            {
                return Result.Ok(new InviteValidationResponse { IsValid = false, Reason = "Canceled" });
            }

            if (invite.Status == TenantInviteStatuses.Accepted)
            {
                return Result.Ok(new InviteValidationResponse { IsValid = false, Reason = "AlreadyAccepted" });
            }

            if (invite.TokenExpiresAt <= DateTime.UtcNow)
            {
                return Result.Ok(new InviteValidationResponse { IsValid = false, Reason = "Expired" });
            }

            ApplicationUser? existingUser = await _userManager.FindByEmailAsync(invite.Email);

            return Result.Ok(new InviteValidationResponse
            {
                IsValid = true,
                Email = invite.Email,
                TenantDisplayName = invite.Tenant?.DisplayName,
                TenantId = invite.TenantId,
                TokenExpiresAt = invite.TokenExpiresAt,
                UserExists = existingUser != null,
            });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate invite token");
            return Result.Fail<InviteValidationResponse>("Failed to validate invite token.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> AcceptInviteAsync(string token, Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return Result.Fail(new BadRequestError("Invite token is required."));
            }

            string tokenHash = HashToken(token);
            TenantInvite? invite = await _tenantInviteRepository.GetByTokenHashAsync(tokenHash, cancellationToken);
            if (invite == null)
            {
                return Result.Fail(new NotFoundError("Invite not found."));
            }

            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                return Result.Fail(new NotFoundError("User not found."));
            }

            Result precheck = await ValidateAcceptPreconditionsAsync(invite, user, cancellationToken);
            if (precheck.IsFailed)
            {
                return precheck;
            }

            // Decide the seat strategy and, when a paid seat is required, increase the Stripe
            // quantity before opening any database transaction (see PrepareSeatForAcceptAsync).
            Result<SeatStrategy> strategyResult = await PrepareSeatForAcceptAsync(invite, user.Id, cancellationToken);
            if (strategyResult.IsFailed)
            {
                return strategyResult.ToResult();
            }

            return await CommitAcceptAsync(invite, user, strategyResult.Value, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to accept invite for user {UserId}", userId);
            return Result.Fail("Failed to accept invite.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<RegisterAndAcceptInviteResponse>> RegisterAndAcceptInviteAsync(
        RegisterAndAcceptInviteRequest request,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Token))
            {
                return Result.Fail<RegisterAndAcceptInviteResponse>(new BadRequestError("Invite token is required."));
            }

            bool passwordlessOnly = _authenticationOptions.Value.PasswordlessOnly;

            // Password-based mode still requires a password (passwordless mode provisions without one).
            if (!passwordlessOnly && string.IsNullOrWhiteSpace(request.Password))
            {
                return Result.Fail<RegisterAndAcceptInviteResponse>(new BadRequestError("Password is required."));
            }

            string tokenHash = HashToken(request.Token);
            TenantInvite? invite = await _tenantInviteRepository.GetByTokenHashAsync(tokenHash, cancellationToken);
            if (invite == null)
            {
                return Result.Fail<RegisterAndAcceptInviteResponse>(new NotFoundError("Invite not found."));
            }

            if (invite.Status == TenantInviteStatuses.Canceled)
            {
                return Result.Fail<RegisterAndAcceptInviteResponse>(new BadRequestError("Invite has been canceled."));
            }

            if (invite.Status == TenantInviteStatuses.Accepted)
            {
                return Result.Fail<RegisterAndAcceptInviteResponse>(new BadRequestError("Invite has already been accepted."));
            }

            if (invite.TokenExpiresAt <= DateTime.UtcNow)
            {
                return Result.Fail<RegisterAndAcceptInviteResponse>(new BadRequestError("Invite has expired."));
            }

            ApplicationUser? existingUser = await _userManager.FindByEmailAsync(invite.Email);
            if (existingUser != null)
            {
                return Result.Fail<RegisterAndAcceptInviteResponse>(new BadRequestError(
                    "An account already exists for this email address. Sign in and retry the invite link."));
            }

            InviteRegisterRequest provisioningRequest = new()
            {
                Email = invite.Email,
                FirstName = request.FirstName,
                LastName = request.LastName,
                // Passwordless-only mode provisions without a password; the service guard above guarantees a
                // non-empty password in password-based mode.
                Password = passwordlessOnly ? null : request.Password,
            };

            // The invitee is a brand-new user, so they cannot already hold a seat. Decide the seat
            // strategy and increase the Stripe quantity (when a paid seat is required) before
            // creating the user — a billing decline aborts here with no user created and nothing to
            // roll back. The Stripe call deliberately runs outside the transaction below.
            Result<SeatStrategy> strategyResult = await PrepareSeatForAcceptAsync(invite, userId: null, cancellationToken);
            if (strategyResult.IsFailed)
            {
                return Result.Fail<RegisterAndAcceptInviteResponse>(strategyResult.Errors);
            }

            Guid newUserId;
            using (TransactionScope transaction = new(
                TransactionScopeOption.Required,
                new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted },
                TransactionScopeAsyncFlowOption.Enabled))
            {
                Result<ApplicationUser> createResult = await _userProvisioningService.CreateUserAsync(
                    provisioningRequest,
                    createdByUserId: invite.InvitedByUserId,
                    cancellationToken: cancellationToken);

                if (createResult.IsFailed)
                {
                    return Result.Fail<RegisterAndAcceptInviteResponse>(createResult.Errors);
                }

                // Local-only DB work (membership, seat materialization, invite accept) enlists in this
                // ambient transaction, so it commits atomically with the user creation above.
                Result acceptResult = await CommitAcceptAsync(invite, createResult.Value, strategyResult.Value, cancellationToken);
                if (acceptResult.IsFailed)
                {
                    return Result.Fail<RegisterAndAcceptInviteResponse>(acceptResult.Errors);
                }

                transaction.Complete();
                newUserId = createResult.Value.Id;
            }

            _logger.LogInformation(
                "Registered new user {UserId} and accepted invite {InviteId} for tenant {TenantId}",
                newUserId, invite.Id, invite.TenantId);

            // In passwordless-only mode, accepting the invite proves possession of the invited inbox — the
            // same trust basis as a passwordless verification code — so sign the user in immediately (mirrors
            // email-confirmation auto-login) rather than requiring a separate sign-in. Token issuance runs
            // after the transaction commits so the new membership is visible.
            if (passwordlessOnly)
            {
                ApplicationUser? newUser = await _userManager.FindByIdAsync(newUserId.ToString());
                if (newUser != null)
                {
                    Result<AuthResponse> autoLoginResult = await _authResponseService.GenerateAuthResponseAsync(
                        newUser, ipAddress, userAgent, cancellationToken: cancellationToken);

                    if (autoLoginResult.IsSuccess)
                    {
                        newUser.LastLoginAt = DateTime.UtcNow;
                        await _userManager.UpdateAsync(newUser);

                        _logger.LogInformation("User {UserId} auto-signed-in after accepting invite (passwordless-only mode)", newUserId);
                        return Result.Ok(new RegisterAndAcceptInviteResponse { AuthResponse = autoLoginResult.Value });
                    }

                    _logger.LogWarning(
                        "Invite accepted for user {UserId} but auto sign-in failed; client will fall back to passwordless sign-in",
                        newUserId);
                }
            }

            return Result.Ok(new RegisterAndAcceptInviteResponse());
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to register user and accept invite");
            return Result.Fail<RegisterAndAcceptInviteResponse>("Failed to register user and accept invite.");
        }
    }

    /// <summary>
    /// Commits invite acceptance — membership, seat assignment/materialization, default-tenant
    /// linkage, and the accepted invite state — as local database work inside a single
    /// <see cref="TransactionScope"/>. Performs no Stripe calls: any required Stripe seat-quantity
    /// increase is done beforehand by <see cref="PrepareSeatForAcceptAsync"/>. When called within
    /// an ambient transaction (the register flow) this enlists in it so user creation and accept
    /// commit atomically.
    /// </summary>
    private async Task<Result> CommitAcceptAsync(TenantInvite invite, ApplicationUser user, SeatStrategy strategy, CancellationToken cancellationToken)
    {
        Guid tenantId = invite.TenantId;
        Guid userId = user.Id;

        using TransactionScope transaction = new(
            TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted },
            TransactionScopeAsyncFlowOption.Enabled);

        Result membershipResult = await EnsureMembershipAsync(userId, tenantId, invite.InvitedByUserId, cancellationToken);
        if (membershipResult.IsFailed)
        {
            return membershipResult;
        }

        Guid? assignedSeatId;
        bool requiresSeatPurchase = false;

        switch (strategy.Kind)
        {
            case SeatStrategyKind.AlreadySeated:
                assignedSeatId = strategy.ExistingSeatId;
                break;

            case SeatStrategyKind.AssignExisting:
                Result<SeatDto> assignResult = await _seatManagementService.AssignSeatAsync(
                    tenantId, strategy.AvailableSeatId!.Value, userId, cancellationToken);
                if (assignResult.IsFailed)
                {
                    _logger.LogWarning("Seat assignment failed during invite accept for user {UserId} tenant {TenantId}: {Errors}",
                        userId, tenantId, string.Join("; ", assignResult.Errors.Select(error => error.Message)));
                    return assignResult.ToResult();
                }
                assignedSeatId = strategy.AvailableSeatId;
                break;

            case SeatStrategyKind.Purchase:
                // The Stripe quantity was already increased in PrepareSeatForAcceptAsync; this only
                // records the local seat and enlists in the ambient transaction.
                Result<SeatDto> materializeResult = await _seatManagementService.MaterializePurchasedSeatAsync(
                    tenantId, userId, cancellationToken);
                if (materializeResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Failed to materialize purchased seat during invite accept for user {UserId} tenant {TenantId}: {Errors}",
                        userId, tenantId, string.Join("; ", materializeResult.Errors.Select(error => error.Message)));
                    return materializeResult.ToResult();
                }
                assignedSeatId = materializeResult.Value.SeatId;
                break;

            default:
                // No seat available and the tier is not per-seat: flag the invite for a manual purchase.
                assignedSeatId = null;
                requiresSeatPurchase = true;
                break;
        }

        await EnsureDefaultTenantAsync(user, tenantId);

        invite.Status = TenantInviteStatuses.Accepted;
        invite.AcceptedAt = DateTime.UtcNow;
        invite.AcceptedByUserId = userId;
        invite.ResultingSeatId = assignedSeatId;
        invite.RequiresSeatPurchase = requiresSeatPurchase;
        invite.ModifiedBy = userId;
        await _tenantInviteRepository.UpdateAsync(invite, cancellationToken);

        transaction.Complete();

        _logger.LogInformation(
            "Invite {InviteId} accepted by user {UserId} on tenant {TenantId}. SeatAssigned={SeatAssigned} RequiresSeatPurchase={RequiresSeatPurchase}",
            invite.Id, userId, tenantId, assignedSeatId.HasValue, requiresSeatPurchase);

        return Result.Ok();
    }

    private async Task<Result> ValidateAcceptPreconditionsAsync(TenantInvite invite, ApplicationUser user, CancellationToken cancellationToken)
    {
        if (invite.Status == TenantInviteStatuses.Canceled)
        {
            return Result.Fail(new BadRequestError("Invite has been canceled."));
        }

        if (invite.Status == TenantInviteStatuses.Accepted)
        {
            return Result.Fail(new BadRequestError("Invite has already been accepted."));
        }

        if (invite.TokenExpiresAt <= DateTime.UtcNow)
        {
            if (invite.Status != TenantInviteStatuses.Expired)
            {
                invite.Status = TenantInviteStatuses.Expired;
                invite.ModifiedBy = user.Id;
                await _tenantInviteRepository.UpdateAsync(invite, cancellationToken);
            }
            return Result.Fail(new BadRequestError("Invite has expired."));
        }

        if (!string.Equals(user.NormalizedEmail, invite.NormalizedEmail, StringComparison.Ordinal))
        {
            return Result.Fail(new ForbiddenError("This invite was issued to a different email address."));
        }

        return Result.Ok();
    }

    private async Task<Result> EnsureMembershipAsync(Guid userId, Guid tenantId, Guid invitedByUserId, CancellationToken cancellationToken)
    {
        UserTenantMembership? existing =
            await _userTenantMembershipRepository.GetByUserAndTenantAsync(userId, tenantId, cancellationToken);
        if (existing is not null)
        {
            if (existing.Status == MembershipStatus.Suspended)
            {
                Result<UserTenantMembership> resumeResult =
                    await _userTenantMembershipService.ResumeMembershipAsync(userId, tenantId, invitedByUserId, cancellationToken);
                return resumeResult.IsFailed ? Result.Fail(resumeResult.Errors) : Result.Ok();
            }

            return Result.Ok();
        }

        Result<UserTenantMembership> addResult = await _userTenantMembershipService.AddUserToTenantWithinTransactionAsync(
            userId: userId,
            tenantId: tenantId,
            role: DefaultInviteRole,
            isDefault: false,
            addedByUserId: invitedByUserId,
            cancellationToken: cancellationToken);

        return addResult.IsFailed ? Result.Fail(addResult.Errors) : Result.Ok();
    }

    /// <summary>
    /// Resolves the seat strategy for accepting an invite and, when a paid seat is required,
    /// increases the Stripe subscription quantity. The Stripe call is performed here — before and
    /// outside any database transaction — so a billing decline aborts cleanly (nothing committed,
    /// admins notified) and no transaction is held open across the external call. The returned
    /// strategy is then committed as local-only work by <see cref="CommitAcceptAsync"/>.
    /// </summary>
    /// <param name="invite">The invite being accepted.</param>
    /// <param name="userId">The accepting user's id, or null for a not-yet-created (register) user.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    private async Task<Result<SeatStrategy>> PrepareSeatForAcceptAsync(TenantInvite invite, Guid? userId, CancellationToken cancellationToken)
    {
        Result<SeatStrategy> strategyResult = await DecideSeatStrategyAsync(invite.TenantId, userId, invite.Id, cancellationToken);
        if (strategyResult.IsFailed)
        {
            return strategyResult;
        }

        SeatStrategy strategy = strategyResult.Value;
        if (strategy.Kind != SeatStrategyKind.Purchase)
        {
            return Result.Ok(strategy);
        }

        Result bumpResult = await _seatManagementService.IncreaseSeatQuantityForPurchaseAsync(invite.TenantId, cancellationToken);
        if (bumpResult.IsFailed)
        {
            // The additional paid seat could not be provisioned (for example, the billing update
            // was declined). Nothing has been written, so acceptance simply aborts; notify the
            // tenant admins so they can resolve billing and re-invite.
            _logger.LogWarning(
                "Failed to increase the Stripe seat quantity while accepting invite {InviteId} on tenant {TenantId}: {Errors}",
                invite.Id, invite.TenantId, string.Join("; ", bumpResult.Errors.Select(error => error.Message)));
            await NotifyAdminsOfSeatPurchaseFailureAsync(invite.TenantId, invite.Email, cancellationToken);
            return Result.Fail<SeatStrategy>(bumpResult.Errors);
        }

        return Result.Ok(strategy);
    }

    /// <summary>
    /// Determines, using read-only queries, how a seat should be acquired when accepting an invite:
    /// reuse the user's existing seat, assign an available seat, purchase one (per-seat tiers), or
    /// flag the invite for a manual purchase (non per-seat tiers). Performs no Stripe calls and no
    /// writes.
    /// </summary>
    /// <param name="tenantId">The tenant the invite belongs to.</param>
    /// <param name="userId">The accepting user's id, or null for a not-yet-created (register) user.</param>
    /// <param name="inviteId">The invite id, used for logging.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    private async Task<Result<SeatStrategy>> DecideSeatStrategyAsync(
        Guid tenantId,
        Guid? userId,
        Guid inviteId,
        CancellationToken cancellationToken)
    {
        // A brand-new (register) user cannot already hold a seat; only check for existing users.
        if (userId.HasValue)
        {
            SubscriptionSeat? existingUserSeat = await _subscriptionSeatRepository.GetByUserAsync(tenantId, userId.Value, cancellationToken);
            if (existingUserSeat != null)
            {
                // Idempotent: a retried accept where the user already holds a seat. Do not purchase.
                return Result.Ok(new SeatStrategy(SeatStrategyKind.AlreadySeated, null, existingUserSeat.SubscriptionSeatId));
            }
        }

        IEnumerable<SubscriptionSeat> availableSeats = await _subscriptionSeatRepository
            .GetAvailableSeatsAsync(tenantId, cancellationToken);
        SubscriptionSeat? firstAvailableSeat = availableSeats.FirstOrDefault();
        if (firstAvailableSeat != null)
        {
            return Result.Ok(new SeatStrategy(SeatStrategyKind.AssignExisting, firstAvailableSeat.SubscriptionSeatId, null));
        }

        Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
        if (tenant == null)
        {
            return Result.Fail<SeatStrategy>(new NotFoundError($"Tenant '{tenantId}' not found."));
        }

        if (_internalDevTenantService.IsInternalDevTenant(tenantId)
            || _subscriptionTierService.IsPerSeatTier(tenant.SubscriptionTier))
        {
            return Result.Ok(new SeatStrategy(SeatStrategyKind.Purchase, null, null));
        }

        _logger.LogInformation(
            "No available seat for invite {InviteId} on non per-seat tenant {TenantId}. Flagging RequiresSeatPurchase.",
            inviteId, tenantId);
        return Result.Ok(new SeatStrategy(SeatStrategyKind.Flag, null, null));
    }

    /// <summary>
    /// Best-effort notification to tenant administrators that an additional paid seat could not be
    /// provisioned during invite acceptance. Recipients are resolved synchronously; the email
    /// sends are dispatched on a background task so the failing accept response is not blocked.
    /// </summary>
    private async Task NotifyAdminsOfSeatPurchaseFailureAsync(Guid tenantId, string inviteeEmail, CancellationToken cancellationToken)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            string tenantDisplayName = tenant?.DisplayName ?? "your organization";

            IEnumerable<UserTenantMembership> memberships =
                await _userTenantMembershipRepository.GetByTenantIdAsync(tenantId, cancellationToken);

            List<string> recipients = memberships
                .Where(membership => string.Equals(membership.Role, AuthRoles.TenantAdmin, StringComparison.OrdinalIgnoreCase))
                .Select(membership => membership.User)
                .Where(user => user != null
                    && user.IsActive
                    && user.EmailNotificationsEnabled
                    && !string.IsNullOrWhiteSpace(user.Email))
                .Select(user => user!.Email!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (recipients.Count == 0)
            {
                _logger.LogWarning("No admin recipients found to notify of seat purchase failure for tenant {TenantId}", tenantId);
                return;
            }

            DispatchSeatPurchaseFailedEmailsInBackground(recipients, tenantDisplayName, inviteeEmail);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to notify admins of seat purchase failure for tenant {TenantId}", tenantId);
        }
    }

    /// <summary>
    /// Sends seat-purchase-failure notifications on a background task so the failing accept
    /// response is not blocked while the email provider waits for full delivery. Uses
    /// <see cref="CancellationToken.None"/> because the request's token is canceled once the
    /// response completes; the email sender is a singleton and safe to use beyond request scope.
    /// </summary>
    private void DispatchSeatPurchaseFailedEmailsInBackground(
        IReadOnlyList<string> recipients,
        string tenantDisplayName,
        string inviteeEmail)
    {
        _ = Task.Run(async () =>
        {
            foreach (string recipient in recipients)
            {
                try
                {
                    await _emailSender.SendSeatPurchaseFailedAsync(recipient, tenantDisplayName, inviteeEmail, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send seat purchase failed notification to {Recipient}", recipient);
                }
            }
        });
    }

    private sealed record SeatStrategy(SeatStrategyKind Kind, Guid? AvailableSeatId, Guid? ExistingSeatId);

    /// <summary>
    /// How a seat is acquired when accepting an invite.
    /// </summary>
    private enum SeatStrategyKind
    {
        /// <summary>The user already holds a seat in the tenant (idempotent retry); reuse it.</summary>
        AlreadySeated,

        /// <summary>An unoccupied seat is available; assign it.</summary>
        AssignExisting,

        /// <summary>No seat available on a per-seat tier; purchase one (Stripe quantity increased first).</summary>
        Purchase,

        /// <summary>No seat available on a non per-seat tier; flag the invite for a manual purchase.</summary>
        Flag,
    }

    private async Task EnsureDefaultTenantAsync(ApplicationUser user, Guid tenantId)
    {
        // Only adopt the inviting tenant as default when the user has no other Active default,
        // mirroring the pre-Phase-4 "unset or stale home" behavior (invariant 11).
        Result<UserTenantMembership?> current = await _userTenantMembershipService.GetCurrentTenantAsync(user.Id);
        if (current.IsSuccess
            && current.Value is { IsDefault: true } existingDefault
            && existingDefault.TenantId != tenantId)
        {
            return;
        }

        Result setDefaultResult = await _userTenantMembershipService.SetDefaultTenantAsync(user.Id, tenantId);
        if (setDefaultResult.IsFailed)
        {
            _logger.LogWarning(
                "Failed to set default membership for user {UserId} to tenant {TenantId}: {Errors}",
                user.Id,
                tenantId,
                string.Join("; ", setDefaultResult.Errors.Select(e => e.Message)));
        }
    }

    /// <summary>
    /// Best-effort email delivery. Logs but does not propagate delivery failures.
    /// </summary>
    private async Task SendInviteEmailSafeAsync(
        TenantInvite invite,
        string rawToken,
        string tenantDisplayName,
        string inviterName,
        CancellationToken cancellationToken)
    {
        try
        {
            await _emailSender.SendInviteAsync(
                email: invite.Email,
                tenantDisplayName: tenantDisplayName,
                inviterName: inviterName,
                rawToken: rawToken,
                expiresAt: invite.TokenExpiresAt,
                cancellationToken: cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send invite email for invite {InviteId} ({Email})", invite.Id, invite.Email);
        }
    }

    /// <summary>
    /// Sends invite emails on a background task so the HTTP response is not blocked
    /// while the email provider waits for full delivery. Uses <see cref="CancellationToken.None"/>
    /// because the request's token is canceled once the response completes. The email
    /// sender is registered as a singleton, so it is safe to use beyond the request scope.
    /// </summary>
    private void DispatchInviteEmailsInBackground(
        IReadOnlyList<(TenantInvite Invite, string RawToken)> toSend,
        string tenantDisplayName,
        string inviterName)
    {
        _ = Task.Run(async () =>
        {
            foreach ((TenantInvite invite, string rawToken) in toSend)
            {
                await SendInviteEmailSafeAsync(invite, rawToken, tenantDisplayName, inviterName, CancellationToken.None);
            }
        });
    }

    private async Task<string> GetDisplayNameAsync(Guid userId)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            return "A teammate";
        }

        string combined = $"{user.FirstName} {user.LastName}".Trim();
        if (!string.IsNullOrWhiteSpace(combined))
        {
            return combined;
        }

        return user.UserName ?? user.Email ?? "A teammate";
    }

    private async Task<InviteResultDto> EvaluateEmailAsync(
        string rawEmail,
        EvaluationContext context,
        int seatsAlreadyClaimed,
        CancellationToken cancellationToken)
    {
        string trimmed = (rawEmail ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(trimmed) || !IsValidEmail(trimmed))
        {
            return new InviteResultDto
            {
                Email = trimmed,
                Outcome = InviteOutcome.Invalid,
                Message = "Email is missing or malformed.",
            };
        }

        string normalized = trimmed.ToUpperInvariant();
        if (!context.SeenInBatch.Add(normalized))
        {
            return new InviteResultDto
            {
                Email = trimmed,
                Outcome = InviteOutcome.AlreadyPending,
                Message = "Duplicate email in this batch.",
            };
        }

        ApplicationUser? existingUser = await _userManager.FindByEmailAsync(trimmed);
        if (existingUser != null
            && await _userTenantMembershipRepository.ExistsAsync(existingUser.Id, context.TenantId, cancellationToken))
        {
            return new InviteResultDto
            {
                Email = trimmed,
                Outcome = InviteOutcome.AlreadyMember,
                Message = "User is already a member of this tenant.",
            };
        }

        if (existingUser != null && existingUser.DeletedOn is null && !context.SkipPriorMemberPrompt)
        {
            IEnumerable<UserTenantMembership> liveMemberships =
                await _userTenantMembershipRepository.GetByUserIdAsync(existingUser.Id, cancellationToken);
            if (!liveMemberships.Any())
            {
                UserTenantMembership? priorMembership =
                    await _userTenantMembershipRepository.GetSoftDeletedByUserAndTenantAsync(
                        existingUser.Id,
                        context.TenantId,
                        cancellationToken);
                if (priorMembership?.DeletedOn is not null)
                {
                    bool allowDifferentPerson = existingUser.LastLoginAt is null
                        || existingUser.LastLoginAt < priorMembership.DeletedOn;
                    bool otherTenants =
                        await _userTenantMembershipRepository.HasSoftDeletedInOtherTenantsAsync(
                            existingUser.Id,
                            context.TenantId,
                            cancellationToken);

                    string displayName = $"{existingUser.FirstName} {existingUser.LastName}".Trim();
                    if (string.IsNullOrWhiteSpace(displayName))
                    {
                        displayName = existingUser.UserName ?? trimmed;
                    }

                    return new InviteResultDto
                    {
                        Email = trimmed,
                        Outcome = InviteOutcome.PriorMemberChoiceRequired,
                        Message = "This email belongs to a prior member. Confirm re-add or different person.",
                        PriorMember = new PriorMemberPromptDto
                        {
                            DisplayName = displayName,
                            Email = trimmed,
                            RemovedOn = priorMembership.DeletedOn.Value,
                            PriorRole = priorMembership.Role,
                            AllowDifferentPerson = allowDifferentPerson,
                            OtherTenantsHaveEndedMemberships = otherTenants,
                        },
                    };
                }
            }
        }

        TenantInvite? existingPending = await _tenantInviteRepository.GetPendingByEmailAsync(context.TenantId, normalized, cancellationToken);
        if (existingPending != null)
        {
            return new InviteResultDto
            {
                Email = trimmed,
                Outcome = InviteOutcome.AlreadyPending,
                Invite = MapToDto(existingPending),
                Message = "A pending invite already exists for this email.",
            };
        }

        (string rawToken, string tokenHash) = GenerateToken();
        bool requiresSeatPurchase = (seatsAlreadyClaimed + 1) > context.AvailableSeats;

        TenantInvite invite = new()
        {
            TenantId = context.TenantId,
            Email = trimmed,
            NormalizedEmail = normalized,
            TokenHash = tokenHash,
            TokenExpiresAt = DateTime.UtcNow.AddDays(context.Config.TokenExpirationDays),
            Status = TenantInviteStatuses.Pending,
            InvitedByUserId = context.InvitedByUserId,
            RequiresSeatPurchase = requiresSeatPurchase,
            CreatedBy = context.InvitedByUserId,
        };
        context.ToInsert.Add((invite, rawToken));

        return new InviteResultDto
        {
            Email = trimmed,
            Outcome = InviteOutcome.Created,
            Invite = MapToDto(invite),
        };
    }

    private sealed record EvaluationContext(
        Guid TenantId,
        Guid InvitedByUserId,
        TenantInviteConfiguration Config,
        int AvailableSeats,
        HashSet<string> SeenInBatch,
        List<(TenantInvite Invite, string RawToken)> ToInsert,
        bool SkipPriorMemberPrompt);

    private static (string RawToken, string TokenHash) GenerateToken()
    {
        byte[] bytes = RandomNumberGenerator.GetBytes(TokenByteLength);
        string raw = Base64UrlEncode(bytes);
        string hash = HashToken(raw);
        return (raw, hash);
    }

    private static string HashToken(string token)
    {
        byte[] hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(hashBytes);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            MailAddress address = new(email);
            return string.Equals(address.Address, email, StringComparison.OrdinalIgnoreCase);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static TenantInviteDto MapToDto(TenantInvite invite) => new()
    {
        Id = invite.Id,
        TenantId = invite.TenantId,
        Email = invite.Email,
        Status = invite.Status,
        TokenExpiresAt = invite.TokenExpiresAt,
        InvitedAt = invite.InvitedAt,
        InvitedByUserId = invite.InvitedByUserId,
        RequiresSeatPurchase = invite.RequiresSeatPurchase,
        AcceptedAt = invite.AcceptedAt,
    };
}
