using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Transactions;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for user provisioning flows such as self-registration and admin user creation.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="UserProvisioningService"/> class.
/// </remarks>
public class UserProvisioningService(
    ILogger<UserProvisioningService> _logger,
    UserManager<ApplicationUser> _userManager,
    IEmailSenderService _emailSender,
    ITenantService _tenantService,
    IUserTenantMembershipService _userTenantMembershipService,
    ISeatManagementService _seatManagementService,
    IUserLifecycleService _userLifecycleService,
    IOptions<PolicyConsentConfiguration> _policyConsentOptions,
    IOptions<AuthenticationConfiguration> _authenticationOptions) : IUserProvisioningService
{

    /// <inheritdoc/>
    public async Task<Result<ApplicationUser>> CreateUserAsync(
        CreateUserRequest request,
        Guid? createdByUserId = null,
        CancellationToken cancellationToken = default,
        Guid? callerActiveTenantId = null,
        bool callerIsGlobalAdministrator = false)
    {
        try
        {
            Result<CreateUserOptions> optionsResult = BuildCreateUserOptions(request);
            if (optionsResult.IsFailed)
            {
                return Result.Fail<ApplicationUser>(optionsResult.Errors);
            }

            CreateUserOptions options = optionsResult.Value;

            Result tenantPlacementGuard = ValidateAdminTenantPlacement(
                options.TenantId,
                createdByUserId,
                callerActiveTenantId,
                callerIsGlobalAdministrator);
            if (tenantPlacementGuard.IsFailed)
            {
                return Result.Fail<ApplicationUser>(tenantPlacementGuard.Errors);
            }

            ApplicationUser? existingUser = await _userManager.FindByEmailAsync(request.Email);
            if (existingUser != null)
            {
                _logger.LogWarning("Attempt to create user with existing email: {Email}", request.Email);

                if (!createdByUserId.HasValue)
                {
                    await SendDuplicateRegistrationNotificationAsync(existingUser, cancellationToken);
                }

                return Result.Fail<ApplicationUser>(new IdentityDuplicateError("A user with this email already exists"));
            }

            Result<List<string>> normalizedRolesResult = NormalizeAndValidateRoles(options.Roles);
            if (normalizedRolesResult.IsFailed)
            {
                return Result.Fail<ApplicationUser>(normalizedRolesResult.Errors);
            }

            List<string> normalizedRoles = normalizedRolesResult.Value;

            ApplicationUser user = BuildApplicationUser(request, options, createdByUserId);
            Guid? seatAssignTenantId = null;

            // Explicit block so Complete()+dispose commit and clear Transaction.Current before
            // post-commit side effects (seat, email, lazy anonymize). A using-declaration would
            // leave the ambient scope until method exit and let anonymize failures doom registration.
            using (TransactionScope transaction = new(asyncFlowOption: TransactionScopeAsyncFlowOption.Enabled))
            {
                IdentityResult createResult = string.IsNullOrWhiteSpace(options.Password)
                    ? await _userManager.CreateAsync(user)
                    : await _userManager.CreateAsync(user, options.Password);

                if (!createResult.Succeeded)
                {
                    Result createFailureResult = await BuildCreateUserFailureResultAsync(createResult, request.Email, createdByUserId, cancellationToken);
                    return Result.Fail<ApplicationUser>(createFailureResult.Errors);
                }

                IdentityResult roleResult = await _userManager.AddToRolesAsync(user, normalizedRoles);
                if (!roleResult.Succeeded)
                {
                    _logger.LogWarning("Failed to assign roles to user {UserId}: {Errors}",
                        user.Id, string.Join(", ", roleResult.Errors.Select(e => e.Description)));
                }

                user.Roles = await _userManager.GetRolesAsync(user);

                bool isSelfRegistration = !createdByUserId.HasValue;
                if (isSelfRegistration)
                {
                    Result<TenantDto> tenantResult = await CreateRegistrationTenantAsync(user, options.Tier, cancellationToken);
                    if (tenantResult.IsFailed)
                    {
                        return Result.Fail<ApplicationUser>(tenantResult.Errors);
                    }

                    // Phase 4: do not write ApplicationUser.TenantId — membership IsDefault is the home pointer.
                }
                else if (options.TenantId.HasValue)
                {
                    Result membershipResult = await AddAdminCreatedUserToTenantAsync(
                        user,
                        options.TenantId.Value,
                        normalizedRoles,
                        createdByUserId!.Value,
                        cancellationToken);
                    if (membershipResult.IsFailed)
                    {
                        return Result.Fail<ApplicationUser>(membershipResult.Errors);
                    }

                    seatAssignTenantId = options.TenantId.Value;
                }

                string logContext = createdByUserId.HasValue
                    ? $"created by admin {createdByUserId.Value}"
                    : "self-registered";

                _logger.LogInformation(
                    "User {UserId} ({Email}) {Context} with roles [{Roles}]",
                    user.Id, request.Email, logContext, string.Join(", ", normalizedRoles));

                transaction.Complete();
            }

            if (seatAssignTenantId.HasValue)
            {
                await _seatManagementService.TryAssignOpenSeatIfAllowedAsync(
                    seatAssignTenantId.Value,
                    user.Id,
                    cancellationToken);
            }

            await SendUserCreationEmailAsync(
                user,
                request.Email,
                normalizedRoles,
                options,
                createdByUserId,
                cancellationToken);

            // Defense-in-depth: after a new Id occupies the email, anonymize any stale Retired
            // row that still held the address. Must not fail registration (invariant 8).
            Result anonymizeResult = await _userLifecycleService.TryAnonymizeStaleRetiredByEmailAsync(
                request.Email,
                cancellationToken);
            if (anonymizeResult.IsFailed)
            {
                _logger.LogWarning(
                    "Lazy anonymization after creating user {UserId} for {Email} failed: {Errors}",
                    user.Id,
                    request.Email,
                    string.Join("; ", anonymizeResult.Errors.Select(e => e.Message)));
            }

            return Result.Ok(user);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user {Email}", request.Email);
            return Result.Fail("Failed to create user. Please try again.");
        }
    }

    private Result<CreateUserOptions> BuildCreateUserOptions(CreateUserRequest request)
    {
        // In passwordless-only mode every account is provisioned for passwordless login regardless of the
        // request, so no user can be created with a password-based login path. BuildApplicationUser couples
        // TwoFactorEnabled to this flag, so 2FA is enabled for these accounts as well.
        bool forcePasswordless = _authenticationOptions.Value.PasswordlessOnly;

        if (request is AddUserRequest addUserRequest)
        {
            List<string> roles = [.. addUserRequest.Roles.Where(role => !string.IsNullOrWhiteSpace(role))];

            if (roles.Count == 0)
            {
                if (request is AddUserRequest)
                {
                    roles.Add(AuthRoles.Developer);
                    _logger.LogInformation("No roles provided for new user {Email}, assigning default role: {DefaultRole}",
                        request.Email, AuthRoles.Developer);
                } else if (request is RegisterRequest)
                {
                    //skip role creation here, register request will default to a tenant scoped admin role
                } else
                {
                    _logger.LogWarning("No roles provided for new user {Email} and request type {RequestType} is unrecognized, assigning default role: {DefaultRole}",
                        request.Email, request.GetType().Name, AuthRoles.Developer);
                }
            }

            CreateUserOptions addUserOptions = new()
            {
                Roles = roles,
                Password = null,
                SendWelcomeEmail = addUserRequest.SendWelcomeEmail,
                UsePasswordlessLogin = forcePasswordless || addUserRequest.UsePasswordlessLogin,
                Tier = null,
                TenantId = addUserRequest.TenantId
            };

            return Result.Ok(addUserOptions);
        }

        if (request is RegisterRequest registerRequest)
        {
            CreateUserOptions registerOptions = new()
            {
                Roles = [AuthRoles.Developer],
                Password = registerRequest.Password,
                SendWelcomeEmail = true,
                UsePasswordlessLogin = forcePasswordless,
                Tier = registerRequest.Tier
            };

            return Result.Ok(registerOptions);
        }

        if (request is InviteRegisterRequest inviteRegisterRequest)
        {
            // Invite acceptance proves email ownership; create pre-confirmed with no emails.
            CreateUserOptions inviteOptions = new()
            {
                Roles = [AuthRoles.Developer],
                Password = inviteRegisterRequest.Password,
                SendWelcomeEmail = false,
                UsePasswordlessLogin = forcePasswordless,
                Tier = null,
                EmailConfirmed = true
            };

            return Result.Ok(inviteOptions);
        }

        _logger.LogWarning("Unsupported create user request type {RequestType}", request.GetType().Name);
        return Result.Fail(new BadRequestError("Unsupported user creation request type"));
    }

    /// <inheritdoc/>
    public async Task<Result<TenantMemberRoleResponse>> AddExistingUserToTenantAsync(
        Guid userId,
        Guid tenantId,
        string role,
        bool isDefault,
        Guid addedByUserId,
        CancellationToken cancellationToken = default)
    {
        if (UserExtensions.GetRoleHierarchyLevel(role) == 0 || role == AuthRoles.Administrator)
        {
            return Result.Fail(new BadRequestError($"'{role}' is not a valid tenant role."));
        }

        ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Fail(new NotFoundError("User not found."));
        }

        Result<UserTenantMembership> membershipResult = await AddMembershipAndHomeTenantAsync(
            user,
            tenantId,
            role,
            isDefault,
            addedByUserId,
            cancellationToken);
        if (membershipResult.IsFailed)
        {
            return Result.Fail(membershipResult.Errors);
        }

        await _seatManagementService.TryAssignOpenSeatIfAllowedAsync(tenantId, userId, cancellationToken);

        return Result.Ok(new TenantMemberRoleResponse
        {
            UserId = userId,
            TenantId = tenantId,
            Role = membershipResult.Value.Role,
            Status = membershipResult.Value.Status.ToString(),
        });
    }

    /// <summary>
    /// Rejects cross-tenant placement when a non-global admin supplies <c>TenantId</c>.
    /// </summary>
    private static Result ValidateAdminTenantPlacement(
        Guid? requestedTenantId,
        Guid? createdByUserId,
        Guid? callerActiveTenantId,
        bool callerIsGlobalAdministrator)
    {
        if (!requestedTenantId.HasValue || !createdByUserId.HasValue || callerIsGlobalAdministrator)
        {
            return Result.Ok();
        }

        if (requestedTenantId != callerActiveTenantId)
        {
            return Result.Fail(new ForbiddenError("You may only add users to your current tenant."));
        }

        return Result.Ok();
    }

    /// <summary>
    /// Adds an admin-created user to the requested tenant and sets home tenant ownership when
    /// unset. Seat assignment runs after the outer create-user transaction commits.
    /// </summary>
    private async Task<Result> AddAdminCreatedUserToTenantAsync(
        ApplicationUser user,
        Guid tenantId,
        IList<string> identityRoles,
        Guid createdByUserId,
        CancellationToken cancellationToken)
    {
        string membershipRole = ResolveTenantMembershipRole(identityRoles);
        Result<UserTenantMembership> membershipResult = await AddMembershipAndHomeTenantAsync(
            user,
            tenantId,
            membershipRole,
            isDefault: true,
            createdByUserId,
            cancellationToken);
        return membershipResult.ToResult();
    }

    /// <summary>
    /// Validates the tenant, creates (or reactivates) membership, and sets home tenant when unset.
    /// </summary>
    private async Task<Result<UserTenantMembership>> AddMembershipAndHomeTenantAsync(
        ApplicationUser user,
        Guid tenantId,
        string role,
        bool isDefault,
        Guid addedByUserId,
        CancellationToken cancellationToken)
    {
        Result<Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
        if (tenantResult.IsFailed)
        {
            return Result.Fail(tenantResult.Errors);
        }

        if (!tenantResult.Value.IsActive)
        {
            return Result.Fail(new ForbiddenError("Tenant is inactive."));
        }

        using TransactionScope transaction = new(TransactionScopeAsyncFlowOption.Enabled);

        Result<UserTenantMembership> membershipResult = await _userTenantMembershipService.AddUserToTenantAsync(
            user.Id,
            tenantId,
            role,
            isDefault,
            addedByUserId: addedByUserId,
            cancellationToken: cancellationToken);
        if (membershipResult.IsFailed)
        {
            return Result.Fail(membershipResult.Errors);
        }

        // Phase 4: do not write ApplicationUser.TenantId as home/authority.

        transaction.Complete();
        return membershipResult;
    }

    /// <summary>
    /// Maps Identity roles from an admin create request onto a tenant membership role.
    /// Global <c>Administrator</c> is never stored on membership.
    /// </summary>
    private static string ResolveTenantMembershipRole(IList<string> identityRoles)
    {
        bool wantsTenantAdmin = identityRoles.Any(role =>
            role.Equals(AuthRoles.TenantAdmin, StringComparison.OrdinalIgnoreCase));
        return wantsTenantAdmin ? AuthRoles.TenantAdmin : AuthRoles.Developer;
    }

    private static Result<List<string>> NormalizeAndValidateRoles(List<string> roles)
    {
        string[] validRoles =
        [
            AuthRoles.Administrator,
            AuthRoles.TenantAdmin,
            AuthRoles.Developer
        ];

        List<string> normalizedRoles = [];
        List<string> invalidRoles = [];

        foreach (string requestedRole in roles)
        {
            string? matchedRole = validRoles.FirstOrDefault(validRole =>
                validRole.Equals(requestedRole, StringComparison.OrdinalIgnoreCase));

            if (matchedRole != null)
            {
                normalizedRoles.Add(matchedRole);
            }
            else
            {
                invalidRoles.Add(requestedRole);
            }
        }

        if (invalidRoles.Count > 0)
        {
            return Result.Fail(new BadRequestError($"Invalid roles: {string.Join(", ", invalidRoles)}"));
        }

        return Result.Ok(normalizedRoles);
    }

    private ApplicationUser BuildApplicationUser(CreateUserRequest request, CreateUserOptions options, Guid? createdByUserId)
    {
        DateTime now = DateTime.UtcNow;
        bool isSelfRegistration = !createdByUserId.HasValue;
        PolicyConsentConfiguration policyConsent = _policyConsentOptions.Value;

        return new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
            IsActive = true,
            EmailConfirmed = options.EmailConfirmed,
            UsePasswordlessLogin = options.UsePasswordlessLogin,
            TwoFactorEnabled = options.UsePasswordlessLogin,
            CreatedOn = now,
            CreatedBy = createdByUserId,
            TermsOfServiceVersionDate = isSelfRegistration ? policyConsent.TermsOfServiceVersionDate : null,
            TermsOfServiceAcceptedOn = isSelfRegistration ? now : null,
            PrivacyPolicyVersionDate = isSelfRegistration ? policyConsent.PrivacyPolicyVersionDate : null,
            PrivacyPolicyAcceptedOn = isSelfRegistration ? now : null
        };
    }

    /// <summary>
    /// Creates a tenant with default placeholder data for a self-registering user.
    /// </summary>
    private async Task<Result<TenantDto>> CreateRegistrationTenantAsync(
        ApplicationUser user,
        string? tier,
        CancellationToken cancellationToken)
    {
        CreateTenantRequest tenantRequest = new()
        {
            TenantName = $"user-{user.Id}",
            DisplayName = $"{user.FirstName} {user.LastName}'s Workspace",
            BillingName = $"{user.FirstName} {user.LastName}",
            Email = user.Email,
            OwnerId = user.Id,
            SubscriptionTier = tier,
            SubscriptionStatus = "incomplete"
        };

        Result<TenantDto> tenantResult = await _tenantService.CreateTenantAsync(tenantRequest, user.Id, isRegistration: true, cancellationToken);

        if (tenantResult.IsFailed)
        {
            _logger.LogError("Failed to create registration tenant for user {UserId}: {Errors}",
                user.Id, string.Join(", ", tenantResult.Errors.Select(e => e.Message)));
        }

        return tenantResult;
    }

    private async Task<Result> BuildCreateUserFailureResultAsync(
        IdentityResult createResult,
        string email,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("User creation failed for {Email}: {Errors}",
            email, string.Join(", ", createResult.Errors.Select(error => error.Description)));

        List<Result> validationErrors = [.. createResult.Errors.Select(ParseIdentityValidationError)];

        if (!createdByUserId.HasValue)
        {
            bool hasDuplicateError = validationErrors.Any(result =>
                result.Errors.Any(error => error is IdentityDuplicateError));

            if (hasDuplicateError)
            {
                ApplicationUser? existingUser = await _userManager.FindByEmailAsync(email);
                if (existingUser != null)
                {
                    await SendDuplicateRegistrationNotificationAsync(existingUser, cancellationToken);
                }
            }
        }

        return validationErrors.Merge();
    }

    private async Task SendUserCreationEmailAsync(
        ApplicationUser user,
        string email,
        List<string> normalizedRoles,
        CreateUserOptions options,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default)
    {
        if (!options.SendWelcomeEmail)
        {
            return;
        }

        string confirmToken = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        string urlParameters = $"{UrlParams.UserId}={user.Id}&{UrlParams.ConfirmToken}={Uri.EscapeDataString(confirmToken)}";

        bool isSelfRegistration = !createdByUserId.HasValue;

        if (isSelfRegistration)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await _emailSender.SendConfirmationEmailAsync(user, email, urlParameters, cancellationToken);

            _logger.LogInformation("Confirmation email sent to user {UserId} ({Email})", user.Id, email);
            return;
        }

        cancellationToken.ThrowIfCancellationRequested();
        await _emailSender.SendWelcomeEmailAsync(user, email, urlParameters, normalizedRoles, options.UsePasswordlessLogin, cancellationToken);

        _logger.LogInformation("Welcome email sent to user {UserId} ({Email})", user.Id, email);
    }

    private sealed class CreateUserOptions
    {
        public required List<string> Roles { get; init; }

        public string? Password { get; init; }

        public bool SendWelcomeEmail { get; init; }

        public bool UsePasswordlessLogin { get; init; }

        public string? Tier { get; init; }

        public bool EmailConfirmed { get; init; }

        public Guid? TenantId { get; init; }
    }

    /// <summary>
    /// Generates a secure random password that meets Identity password requirements.
    /// Uses UserManager password validators to ensure compliance.
    /// </summary>
    /// <param name="attempt">Current attempt number (for recursion protection).</param>
    private async Task<string> GenerateSecurePasswordAsync(int attempt = 0, CancellationToken cancellationToken = default)
    {
        const int maxAttempts = 10;

        if (attempt >= maxAttempts)
        {
            _logger.LogError("Failed to generate valid password after {MaxAttempts} attempts", maxAttempts);
            throw new InvalidOperationException($"Failed to generate a valid password after {maxAttempts} attempts. Check password requirements configuration.");
        }

        const string lowercase = "abcdefghijklmnopqrstuvwxyz";
        const string uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const string digits = "0123456789";
        const string special = "!@#$%^&*()_-+=<>?";

        byte[] random = new byte[32];
        using (RandomNumberGenerator rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(random);
        }

        char[] password = new char[16];
        password[0] = lowercase[random[0] % lowercase.Length];
        password[1] = uppercase[random[1] % uppercase.Length];
        password[2] = digits[random[2] % digits.Length];
        password[3] = special[random[3] % special.Length];

        const string allChars = lowercase + uppercase + digits + special;
        for (int i = 4; i < password.Length; i++)
        {
            password[i] = allChars[random[i] % allChars.Length];
        }

        for (int i = password.Length - 1; i > 0; i--)
        {
            int j = random[i] % (i + 1);
            (password[i], password[j]) = (password[j], password[i]);
        }

        string generatedPassword = new(password);

        ApplicationUser dummyUser = new() { UserName = "temp", Email = "temp@temp.com" };
        foreach (IPasswordValidator<ApplicationUser> validator in _userManager.PasswordValidators)
        {
            IdentityResult result = await validator.ValidateAsync(_userManager, dummyUser, generatedPassword);
            if (!result.Succeeded)
            {
                _logger.LogWarning("Generated password failed validation on attempt {Attempt}: {Errors}",
                    attempt + 1, string.Join(", ", result.Errors.Select(e => e.Description)));

                return await GenerateSecurePasswordAsync(attempt + 1, cancellationToken);
            }
        }

        return generatedPassword;
    }

    /// <summary>
    /// Sends a duplicate registration notification email to an existing user.
    /// </summary>
    /// <param name="existingUser">The existing user to notify.</param>
    private async Task SendDuplicateRegistrationNotificationAsync(ApplicationUser existingUser, CancellationToken cancellationToken = default)
    {
        try
        {
            bool passwordlessOnly = _authenticationOptions.Value.PasswordlessOnly;
            string? urlParameters = null;
            if (!passwordlessOnly)
            {
                string resetToken = await _userManager.GeneratePasswordResetTokenAsync(existingUser);
                urlParameters = $"{UrlParams.UserId}={existingUser.Id}&{UrlParams.ResetToken}={Uri.EscapeDataString(resetToken)}";
            }

            await _emailSender.SendDuplicateRegistrationAttemptAsync(
                existingUser,
                existingUser.Email!,
                urlParameters,
                passwordlessOnly,
                cancellationToken);

            _logger.LogInformation("Duplicate registration notification sent to existing user {UserId} ({Email})",
                existingUser.Id, existingUser.Email);
        }
        catch (Exception emailEx)
        {
            _logger.LogError(emailEx, "Failed to send duplicate registration notification to {Email}", existingUser.Email);
        }
    }

    /// <summary>
    /// Parses IdentityError into appropriate FluentResults Error type.
    /// </summary>
    private static Result ParseIdentityValidationError(Microsoft.AspNetCore.Identity.IdentityError error)
    {
        IdentityErrorDescriber describer = new();

        if (error.Code.Equals(nameof(describer.DuplicateEmail), StringComparison.OrdinalIgnoreCase) ||
            error.Code.Equals(nameof(describer.DuplicateUserName), StringComparison.OrdinalIgnoreCase))
        {
            return Result.Fail(new IdentityDuplicateError(error.Description));
        }

        return Result.Fail(new IdentityValidationError(error.Description));
    }
}
