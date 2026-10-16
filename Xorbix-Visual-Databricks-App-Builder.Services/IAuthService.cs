using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for authentication operations.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Registers a new user account and sends email confirmation.
    /// </summary>
    /// <param name="request">The registration request containing user details.</param>
    /// <param name="ipAddress">The client's IP address for security tracking.</param>
    /// <param name="userAgent">The client's User-Agent for security tracking.</param>
    /// <returns>A result containing the registration email.</returns>
    Task<Result<string>> RegisterAsync(RegisterRequest request, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Registers a new user via the beta signup flow, redeems the beta code, and sends email confirmation.
    /// </summary>
    /// <param name="request">The beta registration request containing user details, tier, and beta code.</param>
    /// <param name="ipAddress">The client's IP address for security tracking.</param>
    /// <param name="userAgent">The client's User-Agent for security tracking.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the registration email.</returns>
    Task<Result<string>> RegisterBetaAsync(BetaRegisterRequest request, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirms a user's email address using the confirmation token. Returns information about whether the user
    /// still needs to set a password. In passwordless-only mode, the confirmation also issues authentication
    /// tokens (<see cref="ConfirmEmailResponse.AuthResponse"/>) so the user is signed in immediately.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="token">The email confirmation token.</param>
    /// <param name="ipAddress">The client's IP address, recorded against any session issued on confirmation.</param>
    /// <param name="userAgent">The client's User-Agent, recorded against any session issued on confirmation.</param>
    /// <returns>A result containing a <see cref="ConfirmEmailResponse"/> with password setup or auto-login info.</returns>
    Task<Result<ConfirmEmailResponse>> ConfirmEmailAsync(Guid userId, string token, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Re-sends email confirmation link to the user.
    /// </summary>
    /// <param name="email">The user's email address.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ResendConfirmationEmailAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Authenticates a user with email and password, returns JWT tokens.
    /// </summary>
    /// <param name="email">The user's email.</param>
    /// <param name="password">The user's password.</param>
    /// <param name="ipAddress">The client's IP address for security tracking.</param>
    /// <param name="userAgent">The client's User-Agent for security tracking.</param>
    /// <returns>A result containing the authentication response with JWT tokens.</returns>
    Task<Result<AuthResponse>> LoginAsync(string email, string password, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirms email change with token.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="newEmail">The new email address.</param>
    /// <param name="token">The confirmation token.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> ConfirmEmailChangeAsync(Guid userId, string newEmail, string token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Enables two-factor authentication for the user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="initiatedByUserId">The ID of the user initiating the change (null for self-service).</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> Enable2FAAsync(Guid userId, Guid? initiatedByUserId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Disables two-factor authentication for the user.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="initiatedByUserId">The ID of the user initiating the change (null for self-service).</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> Disable2FAAsync(Guid userId, Guid? initiatedByUserId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Switches the user's active tenant context and generates a new AuthResponse with updated JWT tokens.
    /// Validates that the user belongs to the target tenant before switching.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="tenantId">The target tenant ID to switch to.</param>
    /// <param name="ipAddress">The client's IP address for security tracking.</param>
    /// <param name="userAgent">The client's User-Agent for security tracking.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A result containing the new AuthResponse with updated tenant context in the JWT.</returns>
    Task<Result<AuthResponse>> SwitchTenantAsync(Guid userId, Guid tenantId, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default);
}

