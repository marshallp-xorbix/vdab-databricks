using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Diagnostics.CodeAnalysis;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for authentication operations.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="AuthService"/> class.
/// </remarks>
[SuppressMessage("Major Code Smell", "S107:Methods should not have too many parameters", Justification = "Coordinator service aggregating identity, email, tenancy, invite, and session subsystems.")]
public class AuthService(
    ILogger<AuthService> _logger,
    UserManager<ApplicationUser> _userManager,
    SignInManager<ApplicationUser> _signInManager,
    IEmailSenderService _emailSender,
    IUserTenantMembershipService _userTenantMembershipService,
    IUserProvisioningService _userProvisioningService,
    IBetaCodeService _betaCodeService,
    IVerificationChallengeService _verificationChallengeService,
    IAuthResponseService _authResponseService,
    ISessionTokenSecurityService _sessionTokenSecurityService,
    IAccountAccessPolicy _accountAccessPolicy,
    IOptions<AuthenticationConfiguration> _authenticationOptions) : IAuthService
{
    private const string UnknownPlaceholder = "unknown";
    private const string UserNotFoundMessage = "User not found";
    private const string RegistrationSuccessMessage = "Registration successful! Please check your email to confirm your account.";

    /// <inheritdoc/>
    public async Task<Result<string>> RegisterAsync(RegisterRequest request, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Registration attempt for email {Email} from IP {IpAddress} with User-Agent {UserAgent}",
                request.Email, ipAddress ?? UnknownPlaceholder, userAgent ?? UnknownPlaceholder);

            // Create user and tenant
            Result<ApplicationUser> createUserResult = await _userProvisioningService.CreateUserAsync(
                request: request,
                createdByUserId: null,
                cancellationToken: cancellationToken);

            if (createUserResult.IsFailed)
            {
                // If email/username already exists , return success to prevent enumeration
                if (createUserResult.HasError<ConflictError>() || createUserResult.HasError<IdentityDuplicateError>())
                {
                    _logger.LogInformation("Registration attempt for existing email {Email} - returning fake success", request.Email);

                    // Return success message as if user was created
                    return Result.Ok(request.Email).WithSuccess(RegistrationSuccessMessage);
                }

                return Result.Fail(createUserResult.Errors);
            }

            ApplicationUser user = createUserResult.Value;

            string successMessage = user.UsePasswordlessLogin
                ? RegistrationSuccessMessage
                : "User created successfully. A welcome email will be sent with instructions to set up their password.";

            return Result.Ok(user.Email ?? request.Email).WithSuccess(successMessage);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Unexpected fault → ExceptionalError maps to 500 (retryable), not an untyped 400.
            _logger.LogError(ex, "Error during registration for {Email}", request.Email);
            return Result.Fail(new ExceptionalError("Registration failed. Please try again.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<string>> RegisterBetaAsync(
        BetaRegisterRequest request,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Tier))
            {
                return Result.Fail(new BadRequestError("Tier is required."));
            }

            Result<BetaCodeValidationDto> previewResult = await _betaCodeService.ValidatePreviewAsync(
                request.BetaCode,
                request.Tier,
                cancellationToken);

            if (previewResult.IsFailed)
            {
                return Result.Fail<string>(previewResult.Errors);
            }

            Result<ApplicationUser> createUserResult = await _userProvisioningService.CreateUserAsync(
                request: request,
                createdByUserId: null,
                cancellationToken: cancellationToken);

            if (createUserResult.IsFailed)
            {
                if (createUserResult.HasError<ConflictError>() || createUserResult.HasError<IdentityDuplicateError>())
                {
                    _logger.LogInformation(
                        "Beta registration attempt for existing email {Email} - returning fake success",
                        request.Email);

                    return Result.Ok(request.Email).WithSuccess(RegistrationSuccessMessage);
                }

                return Result.Fail<string>(createUserResult.Errors);
            }

            ApplicationUser user = createUserResult.Value;
            Result<UserTenantMembership?> homeMembershipResult =
                await _userTenantMembershipService.GetCurrentTenantAsync(user.Id, cancellationToken);
            if (homeMembershipResult.IsFailed || homeMembershipResult.Value is null)
            {
                _logger.LogError(
                    "Beta registration created user {UserId} without a default membership; cannot redeem beta code",
                    user.Id);

                return Result.Fail<string>(new BadRequestError(
                    "Account was created but tenant setup failed. Please contact support."));
            }

            Guid tenantId = homeMembershipResult.Value.TenantId;
            Result<SubscriptionDto> redeemResult = await _betaCodeService.RedeemAndSubscribeAsync(
                tenantId,
                user.Id,
                request.BetaCode,
                cancellationToken);

            if (redeemResult.IsFailed)
            {
                _logger.LogError(
                    "Beta code redemption failed for user {UserId}, tenant {TenantId}: {Errors}",
                    user.Id,
                    tenantId,
                    string.Join(", ", redeemResult.Errors.Select(error => error.Message)));

                return Result.Fail<string>(redeemResult.Errors);
            }

            _logger.LogInformation(
                "Beta registration completed for user {UserId}, tenant {TenantId}, subscription {SubscriptionId}",
                user.Id,
                tenantId,
                redeemResult.Value.Id);

            return Result.Ok(user.Email ?? request.Email).WithSuccess(RegistrationSuccessMessage);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during beta registration for {Email}", request.Email);
            return Result.Fail<string>(new ExceptionalError("Registration failed. Please try again.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<ConfirmEmailResponse>> ConfirmEmailAsync(Guid userId, string token, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());

            if (user == null)
            {
                _logger.LogWarning("Email confirmation attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError(UserNotFoundMessage));
            }

            if (user.EmailConfirmed)
            {
                _logger.LogInformation("Email already confirmed for user {UserId}", userId);
                return Result.Ok(new ConfirmEmailResponse());
            }

            IdentityResult result = await _userManager.ConfirmEmailAsync(user, token);

            if (!result.Succeeded)
            {
                _logger.LogWarning("Email confirmation failed for user {UserId}. Token (len {Len}): {TokenPrefix}... Errors: {Errors}",
                    userId, token.Length, token.Substring(0, System.Math.Min(10, token.Length)), string.Join(", ", result.Errors.Select(e => e.Description)));
                _logger.LogTrace("Full result: {@Result}", result);
                return Result.Fail(new BadRequestError("Invalid or expired confirmation token"));
            }

            _logger.LogInformation("Email confirmed successfully for user {UserId} ({Email})", userId, user.Email);

            // In passwordless-only mode, confirming the email proves possession of the inbox — the same trust
            // basis as a passwordless verification code — so sign the user in immediately and let them continue
            // straight into account setup instead of bouncing them through a separate sign-in.
            if (_authenticationOptions.Value.PasswordlessOnly && user.IsActive)
            {
                Result<AuthResponse> autoLoginResult = await _authResponseService.GenerateAuthResponseAsync(
                    user, ipAddress, userAgent, cancellationToken: cancellationToken);

                if (autoLoginResult.IsSuccess)
                {
                    user.LastLoginAt = DateTime.UtcNow;
                    await _userManager.UpdateAsync(user);

                    _logger.LogInformation("User {UserId} auto-signed-in after email confirmation (passwordless-only mode)", userId);
                    return Result.Ok(new ConfirmEmailResponse { AuthResponse = autoLoginResult.Value });
                }

                // Token issuance failed; fall back to a plain confirmation so the user can sign in via the
                // passwordless flow rather than getting stuck on the confirmation page.
                _logger.LogWarning("Email confirmed for user {UserId} but auto sign-in failed; returning plain confirmation", userId);
                return Result.Ok(new ConfirmEmailResponse());
            }

            bool hasPassword = await _userManager.HasPasswordAsync(user);
            bool requiresPasswordSetup = !hasPassword && !user.UsePasswordlessLogin;

            ConfirmEmailResponse response = new()
            {
                RequiresPasswordSetup = requiresPasswordSetup,
                UserId = requiresPasswordSetup ? userId : null,
                PasswordResetToken = requiresPasswordSetup
                    ? await _userManager.GeneratePasswordResetTokenAsync(user)
                    : null
            };

            return Result.Ok(response);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Unexpected fault → ExceptionalError maps to 500 (retryable), not an untyped 400.
            _logger.LogError(ex, "Error confirming email for user {UserId}", userId);
            return Result.Fail(new ExceptionalError("Email confirmation failed. Please try again.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<AuthResponse>> LoginAsync(string email, string password, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default)
    {
        try
        {
            // Password sign-in is disabled application-wide in passwordless-only mode. The SPA already routes
            // users to the passwordless flow; this guard enforces it for any direct API caller.
            if (_authenticationOptions.Value.PasswordlessOnly)
            {
                _logger.LogWarning("Password login attempt rejected for {Email}: passwordless-only mode is enabled", email);
                return Result.Fail(new ForbiddenError("Password sign-in is disabled. Please use passwordless sign-in."));
            }

            ApplicationUser? user = await _userManager.FindByEmailAsync(email);

            if (!_accountAccessPolicy.CanAuthenticate(user))
            {
                _logger.LogWarning("Login attempt for invalid or inactive user: {Email}", email);
                return Result.Fail(new UnauthorizedError("Invalid credentials"));
            }

            if (!user!.EmailConfirmed)
            {
                _logger.LogWarning("Login attempt for user with unconfirmed email: {UserId}", user.Id);
                return Result.Fail(new UnauthorizedError("Please confirm your email address before logging in"));
            }

            SignInResult result = await _signInManager
                .CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);

            if (!result.Succeeded)
            {
                if (result.IsLockedOut)
                {
                    _logger.LogWarning("Login attempt for locked out user: {UserId}", user.Id);
                    return Result.Fail(new UnauthorizedError("Account is locked out"));
                }

                _logger.LogWarning("Failed login attempt for user: {UserId}", user.Id);
                return Result.Fail(new UnauthorizedError("Invalid credentials"));
            }

            VerificationChallengeResponse? twoFactorChallenge = null;
            if (user.TwoFactorEnabled)
            {
                Result<VerificationChallengeResponse> challengeResult = await _verificationChallengeService.SendVerificationCodeAsync(email, VerificationIssuanceScope.PasswordVerified, user, cancellationToken);
                if (challengeResult.IsFailed)
                {
                    return challengeResult.ToResult();
                }
                twoFactorChallenge = challengeResult.Value;
            }

            Result<AuthResponse> authResponse = await _authResponseService.GenerateAuthResponseAsync(user, ipAddress, userAgent, twoFactorChallenge, cancellationToken);

            if (authResponse.IsFailed)
            {
                return authResponse;
            }

            user.LastLoginAt = DateTime.UtcNow;
            await _userManager.UpdateAsync(user);

            _logger.LogInformation("User {UserId} logged in successfully from IP {IpAddress}", user.Id, ipAddress ?? UnknownPlaceholder);
            return authResponse;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // A failure here is an unexpected infrastructure fault (e.g. a transient database error
            // from a cold connection), not a rejected credential. An ExceptionalError maps to a 500
            // (see HandleFluentResult) so the client treats it as retryable, instead of the untyped
            // 400 that the UI would misreport to the user as bad credentials.
            _logger.LogError(ex, "Error during login for {Email}", email);
            return Result.Fail(new ExceptionalError("Login failed. Please try again.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ResendConfirmationEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByEmailAsync(email);

            // Always return success to prevent email enumeration
            if (user == null || !user.IsActive)
            {
                _logger.LogWarning("Resend confirmation attempt for non-existent or inactive email: {Email}", email);
                return Result.Ok();
            }

            // Check if already confirmed
            if (user.EmailConfirmed)
            {
                _logger.LogInformation("Resend confirmation attempt for already confirmed email: {Email}", email);
                return Result.Ok();
            }

            // Generate new confirmation token
            string token = await _userManager.GenerateEmailConfirmationTokenAsync(user);

            // Build confirmation URL parameters
            string urlParameters = $"{UrlParams.UserId}={user.Id}&{UrlParams.ConfirmToken}={Uri.EscapeDataString(token)}";

            await _emailSender.SendConfirmationEmailAsync(user, user.Email!, urlParameters);

            _logger.LogInformation("Confirmation email resent to {Email}", user.Email);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resending confirmation email to {Email}", email);
            // Still return success to prevent enumeration
            return Result.Ok();
        }
    }

    /// <inheritdoc/>
    public async Task<Result> Enable2FAAsync(Guid userId, Guid? initiatedByUserId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Enable 2FA attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError(UserNotFoundMessage));
            }

            if (user.TwoFactorEnabled)
            {
                _logger.LogInformation("2FA already enabled for user {UserId}", userId);
                return Result.Ok();
            }

            IdentityResult result = await _userManager.SetTwoFactorEnabledAsync(user, true);
            if (!result.Succeeded)
            {
                _logger.LogWarning("Failed to enable 2FA for user {UserId}: {Errors}",
                    userId, string.Join(", ", result.Errors.Select(e => e.Description)));
                return Result.Fail("Failed to enable two-factor authentication");
            }

            // Update modification tracking
            user.ModifiedOn = DateTime.UtcNow;
            user.ModifiedBy = initiatedByUserId ?? userId;
            await _userManager.UpdateAsync(user);

            _logger.LogInformation("2FA enabled successfully for user {UserId}", userId);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Unexpected fault → ExceptionalError maps to 500 (retryable), not an untyped 400.
            _logger.LogError(ex, "Error enabling 2FA for user {UserId}", userId);
            return Result.Fail(new ExceptionalError("Failed to enable two-factor authentication. Please try again.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> Disable2FAAsync(Guid userId, Guid? initiatedByUserId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Disable 2FA attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError(UserNotFoundMessage));
            }

            if (!user.TwoFactorEnabled)
            {
                _logger.LogInformation("2FA already disabled for user {UserId}", userId);
                return Result.Ok();
            }

            IdentityResult result = await _userManager.SetTwoFactorEnabledAsync(user, false);
            if (!result.Succeeded)
            {
                _logger.LogWarning("Failed to disable 2FA for user {UserId}: {Errors}",
                    userId, string.Join(", ", result.Errors.Select(e => e.Description)));
                return Result.Fail("Failed to disable two-factor authentication");
            }

            // Update modification tracking
            user.ModifiedOn = DateTime.UtcNow;
            user.ModifiedBy = initiatedByUserId ?? userId;
            await _userManager.UpdateAsync(user);

            _logger.LogInformation("2FA disabled successfully for user {UserId}", userId);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Unexpected fault → ExceptionalError maps to 500 (retryable), not an untyped 400.
            _logger.LogError(ex, "Error disabling 2FA for user {UserId}", userId);
            return Result.Fail(new ExceptionalError("Failed to disable two-factor authentication. Please try again.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ConfirmEmailChangeAsync(Guid userId, string newEmail, string token, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                _logger.LogWarning("Confirm email change attempt for non-existent user {UserId}", userId);
                return Result.Fail(new NotFoundError(UserNotFoundMessage));
            }

            IdentityResult result = await _userManager.ChangeEmailAsync(user, newEmail, token);
            if (!result.Succeeded)
            {
                _logger.LogWarning("Email change confirmation failed for user {UserId}: {Errors}",
                    userId, string.Join(", ", result.Errors.Select(e => e.Description)));
                return Result.Fail("Invalid or expired confirmation token");
            }

            // Update username to match new email
            await _userManager.SetUserNameAsync(user, newEmail);

            // Update modification tracking
            user.ModifiedOn = DateTime.UtcNow;
            // Called from unauthenticated flow, so set to self for now.
            user.ModifiedBy = userId;
            await _userManager.UpdateAsync(user);

            // Update security stamp to invalidate all existing tokens and sessions
            Result stampResult = await _sessionTokenSecurityService.ForceLogoutAllDevicesAsync(userId, cancellationToken);
            if (stampResult.IsFailed)
            {
                _logger.LogWarning("Email changed but failed to invalidate sessions for user {UserId}", userId);
            }

            _logger.LogInformation("Email changed successfully for user {UserId} to {NewEmail}", userId, newEmail);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Unexpected fault → ExceptionalError maps to 500 (retryable), not an untyped 400.
            _logger.LogError(ex, "Error confirming email change for user {UserId}", userId);
            return Result.Fail(new ExceptionalError("Failed to confirm email change. Please try again.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<AuthResponse>> SwitchTenantAsync(Guid userId, Guid tenantId, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Tenant switch requested for user {UserId} to tenant {TenantId}", userId, tenantId);

            // Validate user belongs to the target tenant
            bool belongsToTenant = await _userTenantMembershipService.UserBelongsToTenantAsync(userId, tenantId, cancellationToken);
            if (!belongsToTenant)
            {
                _logger.LogWarning("User {UserId} attempted to switch to tenant {TenantId} without membership", userId, tenantId);
                return Result.Fail(new ForbiddenError("You do not have access to this tenant"));
            }

            // Get the ApplicationUser
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                return Result.Fail(new NotFoundError($"User {userId} not found"));
            }

            // Switch tenant context (updates LastAccessedAt)
            Result<UserTenantMembership> switchResult = await _userTenantMembershipService.SwitchTenantAsync(userId, tenantId, cancellationToken);
            if (switchResult.IsFailed)
            {
                return Result.Fail(switchResult.Errors);
            }

            // Generate new auth response with the switched tenant context
            return await _authResponseService.GenerateAuthResponseForTenantAsync(user, tenantId, switchResult.Value.Role, ipAddress, userAgent, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Unexpected fault → ExceptionalError maps to 500 (retryable), not an untyped 400.
            _logger.LogError(ex, "Error switching tenant for user {UserId} to tenant {TenantId}", userId, tenantId);
            return Result.Fail(new ExceptionalError("An error occurred while switching tenant. Please try again.", ex));
        }
    }

}
