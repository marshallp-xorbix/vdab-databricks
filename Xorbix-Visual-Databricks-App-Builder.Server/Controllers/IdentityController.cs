using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Net.Mime;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Server.Middleware;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Controller for identity and authentication operations.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="IdentityController"/> class.
/// </remarks>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class IdentityController(
    IAuthService _authService,
    IVerificationChallengeService _verificationChallengeService,
    IPasswordLifecycleService _passwordLifecycleService,
    ISessionTokenSecurityService _sessionTokenSecurityService,
    IUserService _userService,
    ILogger<IdentityController> _logger) : AuthenticatedControllerBase
{
#pragma warning disable CA1873 // Avoid potentially expensive logging

    /// <summary>
    /// Registers a new user account and sends email confirmation.
    /// </summary>
    /// <param name="request">Registration details. Use <see cref="RegisterRequest"/>  </param>
    /// <returns>Registration email on all paths, except failed email validation or unhandled exceptions.</returns>
    [HttpPost("register")]
    [AllowAnonymous]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<string>> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        string? userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        _logger.LogInformation("Registration attempt for email {Email} from IP {IpAddress} with User-Agent {UserAgent}",
            request.Email, ipAddress, userAgent);

        Result<string> result = await _authService.RegisterAsync(request, ipAddress, userAgent, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Registers a new user via the beta signup flow, redeems the beta code, and sends email confirmation.
    /// </summary>
    /// <param name="request">Beta registration details including tier and beta code.</param>
    /// <returns>Registration email on success.</returns>
    [HttpPost("register/beta")]
    [AllowAnonymous]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status410Gone)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<string>> RegisterBeta([FromBody] BetaRegisterRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        string? userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        _logger.LogInformation(
            "Beta registration attempt for email {Email}, tier {Tier} from IP {IpAddress} with User-Agent {UserAgent}",
            request.Email,
            request.Tier,
            ipAddress,
            userAgent);

        Result<string> result = await _authService.RegisterBetaAsync(request, ipAddress, userAgent, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Confirms a user's email address. Confirmation token is stored in the database. Used in email confirmation flow.
    /// </summary>
    /// <param name="request">The <see cref="ConfirmEmailRequest"/> containing user ID and token.</param>
    /// <returns>A <see cref="ConfirmEmailResponse"/> indicating whether the user needs to set a password.</returns>
    [HttpPost("register/confirm-email")]
    [AllowAnonymous]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<ConfirmEmailResponse>> ConfirmEmail([FromBody] ConfirmEmailRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        string? userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        _logger.LogInformation("Email confirmation attempt for user {UserId}", request.UserId);

        Result<ConfirmEmailResponse> result = await _authService.ConfirmEmailAsync(request.UserId, request.Token, ipAddress, userAgent, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Re-sends the email confirmation link to the user.
    /// </summary>
    /// <param name="request">The <see cref="EmailRequest"/> containing the email address.</param>
    /// <returns>Success response on all paths to prevent email enumeration.</returns>
    [HttpPost("register/resend-confirmation")]
    [AllowAnonymous]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> ResendConfirmation([FromBody] EmailRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        _logger.LogInformation("Resend confirmation attempt for email {Email} from IP {IpAddress}",
            request.Email, ipAddress);

        Result result = await _authService.ResendConfirmationEmailAsync(request.Email, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Authenticates a user and returns JWT tokens.
    /// </summary>
    /// <param name="request">Login credentials. Use <see cref="LoginRequest"/>.</param>
    /// <returns><see cref="AuthResponse"/> with JWT tokens.</returns>
    [HttpPost("login")]
    [AllowAnonymous]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        string? userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        _logger.LogInformation("Login attempt for email {Email} from IP {IpAddress} with User-Agent {UserAgent}",
            request.Email, ipAddress, userAgent);
        Result<AuthResponse> result = await _authService.LoginAsync(request.Email, request.Password, ipAddress, userAgent, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Initiates passwordless authentication by sending a verification code to the user's email.
    /// </summary>
    /// <param name="request">The <see cref="EmailRequest"/> containing the email address.</param>
    /// <returns>Code expiry and the next instant a code may be requested. Returned on all outcomes except throttling and unhandled exceptions.</returns>
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingPolicyNames.IdentityAnonymous)]
    [HttpPost("passwordless/login")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(VerificationChallengeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<VerificationChallengeResponse>> PasswordlessSignIn([FromBody] EmailRequest request, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Passwordless login attempt for email {Email}", request.Email);

        Result<VerificationChallengeResponse> result = await _verificationChallengeService.SendVerificationCodeAsync(
            request.Email, VerificationIssuanceScope.Anonymous, cancellationToken: cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Resends the two-factor authentication code.
    /// </summary>
    /// <param name="request">The <see cref="EmailRequest"/> containing the email address.</param>
    /// <returns>Code expiry and the next instant a code may be requested.</returns>
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingPolicyNames.IdentityAnonymous)]
    [HttpPost("2fa/resend")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(VerificationChallengeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<VerificationChallengeResponse>> ResendTwoFactorCode([FromBody] EmailRequest request, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Resending two-factor authentication code for email {Email}", request.Email);

        // Resend is anonymous (the caller isn't re-authenticated here), but uses its own scope so a
        // passwordless-sign-in flood on the same address can't starve a mid-login user's resend.
        Result<VerificationChallengeResponse> result = await _verificationChallengeService.SendVerificationCodeAsync(
            request.Email, VerificationIssuanceScope.TwoFactorResend, cancellationToken: cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Verifies an authentication code (2FA or passwordless) and returns JWT tokens.
    /// </summary>
    /// <param name="request">The <see cref="VerifyCodeRequest"/> containing email and code.</param>
    /// <returns><see cref="AuthResponse"/> with JWT tokens.</returns>
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingPolicyNames.IdentityAnonymous)]
    [HttpPost("verify-code")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthResponse>> VerifyCode([FromBody] VerifyCodeRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        string? userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        _logger.LogInformation("Verifying authentication code for email {Email} from IP {IpAddress} with User-Agent {UserAgent}",
            request.Email, ipAddress, userAgent);
        Result<AuthResponse> result = await _verificationChallengeService.VerifyCodeAndAuthenticateAsync(request.Email, request.Code, ipAddress, userAgent, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Refreshes the JWT access token using a refresh token.
    /// </summary>
    /// <param name="request">The <see cref="RefreshTokenRequest"/> containing the refresh token.</param>
    /// <returns><see cref="AuthResponse"/> with new JWT tokens.</returns>
    [AllowAnonymous]
    [HttpPost("token/refresh")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<AuthResponse>> RefreshToken([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        string? userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        _logger.LogInformation("Token refresh attempt from IP {IpAddress}", ipAddress);

        Result<AuthResponse> result = await _sessionTokenSecurityService.RefreshTokenAsync(request.RefreshToken, ipAddress, userAgent, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Logs out the current session by revoking the supplied refresh token.
    /// Other active sessions on other devices remain valid.
    /// </summary>
    /// <param name="request">The <see cref="RefreshTokenRequest"/> containing the refresh token for this session.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure response.</returns>
    [AuditLog("Logout", "user")]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Logging out current session for user {UserId}", userId);

        Result result = await _sessionTokenSecurityService.LogoutCurrentSessionAsync(userId, request.RefreshToken, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Logs the current user out of every device by revoking all refresh tokens and rotating the security stamp.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success or failure response.</returns>
    [HttpPost("logout/all")]
    public async Task<IActionResult> LogoutAll(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Logging out all devices for user {UserId}", userId);

        Result result = await _sessionTokenSecurityService.ForceLogoutAllDevicesAsync(userId, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Initiates password reset by sending a reset link to the user's email.
    /// </summary>
    /// <param name="request">The <see cref="EmailRequest"/> containing the email address.</param>
    /// <returns>Success response on all paths to prevent email enumeration.</returns>
    [HttpPost("password/forgot")]
    [AllowAnonymous]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> ForgotPassword([FromBody] EmailRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        _logger.LogInformation("Forgot password attempt for email {Email} from IP {IpAddress}",
            request.Email, ipAddress);

        Result result = await _passwordLifecycleService.ForgotPasswordAsync(request.Email, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Resets a user's password using a reset token.
    /// </summary>
    /// <param name="request">The <see cref="ResetPasswordRequest"/> containing email, token, and new password.</param>
    /// <returns>Success or failure response.</returns>
    [HttpPost("password/reset")]
    [AllowAnonymous]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        _logger.LogInformation("Reset password attempt for email {Email} or userId {UserId} from IP {IpAddress}",
            request.Email, request.UserId, ipAddress);

        Result result;
        if (request.UserId.HasValue)
        {
             result = await _passwordLifecycleService.ResetPasswordAsync(request.UserId.Value, request.Token, request.NewPassword, cancellationToken);
        }
        else if (!string.IsNullOrEmpty(request.Email))
        {
             result = await _passwordLifecycleService.ResetPasswordAsync(request.Email, request.Token, request.NewPassword, cancellationToken);
        }
        else
        {
            return BadRequest("Email or UserId is required.");
        }

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Checks whether the target user already has a password set.
    /// </summary>
    /// <param name="userId">The user ID from the setup link.</param>
    /// <returns>True when a password is already set; otherwise false.</returns>
    [AllowAnonymous]
    [HttpGet("password/status")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<bool>> GetPasswordStatus([FromQuery] Guid userId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Password status check attempt for user {UserId}", userId);

        Result<bool> result = await _passwordLifecycleService.IsPasswordAlreadySetAsync(userId, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets the account setup completion status for the authenticated user.
    /// Used after initial login to determine if the user needs to complete setup steps.
    /// </summary>
    /// <param name="cancellationToken">The request cancellation token.</param>
    /// <returns><see cref="AccountSetupStatusDto"/> with setup completion state.</returns>
    [HttpGet("account-setup-status")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<AccountSetupStatusDto>> GetAccountSetupStatus(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Account setup status check for user {UserId}", userId);

        Result<AccountSetupStatusDto> result = await _userService.GetAccountSetupStatusAsync(
            userId,
            AuthenticatedTenantId,
            cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Records the authenticated user's acceptance of the current Terms of Service
    /// and/or Privacy Policy version(s). Called by the post-login policy-gate page.
    /// </summary>
    /// <param name="request">Which policies the user is accepting.</param>
    /// <param name="cancellationToken">The request cancellation token.</param>
    /// <returns>204 No Content on success.</returns>
    [HttpPost("accept-policies")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> AcceptPolicies([FromBody] AcceptPoliciesRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation(
            "Policy acceptance request for user {UserId} (ToS={ToS}, Privacy={Privacy})",
            userId, request.AcceptTermsOfService, request.AcceptPrivacyPolicy);

        Result result = await _userService.AcceptPoliciesAsync(
            userId,
            request.AcceptTermsOfService,
            request.AcceptPrivacyPolicy,
            cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Gets the current authenticated user's profile including settings and metadata.
    /// </summary>
    /// <returns>Current <see cref="UserProfileResponse"/>.</returns>
    [AuditLog("Login", "user")]
    [HttpGet("profile")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<ActionResult<UserProfileResponse>> GetCurrentUser(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Fetching current user profile for UserId {UserId}", userId);

        Result<UserProfileResponse> result = await _userService.GetCurrentUserProfileAsync(
            userId,
            AuthenticatedTenantId,
            AuthenticatedTenantRole,
            cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Updates the authenticated user's profile (first name and last name).
    /// </summary>
    /// <param name="request">The <see cref="UpdateProfileRequest"/> containing updated profile information.</param>
    /// <returns>Success or failure response.</returns>
    [AuditLog("Update", "user")]
    [HttpPut("profile")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Update profile attempt for user {UserId}", userId);

        Result result = await _userService.UpdateProfileAsync(userId, request, cancellationToken);

        return this.HandleFluentResult(result);
    }
    /// <summary>
    /// Changes the authenticated user's password.
    /// </summary>
    /// <param name="request">The <see cref="ChangePasswordRequest"/> containing current and new password.</param>
    /// <returns>Success or failure response.</returns>
    [AuditLog("Update", "user")]
    [HttpPost("profile/password")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Change password attempt for user {UserId}", userId);

        Result result = await _passwordLifecycleService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Initiates email change for the authenticated user. Sends confirmation email to new address.
    /// </summary>
    /// <param name="request">The <see cref="ChangeEmailRequest"/> containing the new email.</param>
    /// <returns>Success or failure response.</returns>
    [AuditLog("Update", "user")]
    [HttpPost("profile/email")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ChangeEmail([FromBody] ChangeEmailRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        _logger.LogInformation("Change email attempt for user {UserId} from IP {IpAddress}", userId, ipAddress);

        Result result = await _userService.ChangeEmailAsync(
            userId,
            request.NewEmail,
            request.CurrentPassword,
            cancellationToken: cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Confirms email change with token sent to new email address.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="newEmail">The new email address.</param>
    /// <param name="token">The confirmation token.</param>
    /// <returns>Success or failure response.</returns>
    [HttpPost("profile/email/confirm")]
    [AllowAnonymous]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> ConfirmEmailChange([FromQuery] Guid userId, [FromQuery] string newEmail, [FromQuery] string token, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Confirm email change attempt for user {UserId} to {NewEmail}", userId, newEmail);

        Result result = await _authService.ConfirmEmailChangeAsync(userId, newEmail, token, cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Enables two-factor authentication for the authenticated user.
    /// </summary>
    /// <returns>Success or failure response.</returns>
    [HttpPost("profile/2fa/enable")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> Enable2FA(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Enable 2FA attempt for user {UserId}", userId);

        Result result = await _authService.Enable2FAAsync(userId, cancellationToken: cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Disables two-factor authentication for the authenticated user.
    /// </summary>
    /// <returns>Success or failure response.</returns>
    [HttpPost("profile/2fa/disable")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> Disable2FA(CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Disable 2FA attempt for user {UserId}", userId);

        Result result = await _authService.Disable2FAAsync(userId, cancellationToken: cancellationToken);

        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Updates the authenticated user's account settings (security and notification preferences).
    /// </summary>
    /// <param name="request">The <see cref="UpdateUserSettingsRequest"/> containing settings to update.</param>
    /// <returns>Success or failure response.</returns>
    [HttpPut("profile/settings")]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateUserSettingsRequest request, CancellationToken cancellationToken = default)
    {
        ActionResult? authFailure = RequireAuthenticatedUser(out Guid userId);
        if (authFailure is not null)
            return authFailure;

        _logger.LogInformation("Update settings attempt for user {UserId}", userId);

        Result<ApplicationUser> settingsResult = await _userService.UpdateUserSettingsAsync(userId, request, userId, cancellationToken);

        return this.HandleFluentResult(settingsResult.ToResult());
    }

#pragma warning restore CA1873 // Avoid potentially expensive logging
}