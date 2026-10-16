using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for issuing authentication responses with access and refresh tokens.
/// </summary>
public class AuthResponseService : IAuthResponseService
{
    private readonly ILogger<AuthResponseService> _logger;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtService _jwtService;
    private readonly IUserTenantMembershipService _userTenantMembershipService;

    /// <summary>
    /// Initializes a new instance of the <see cref="AuthResponseService"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    /// <param name="userManager">The user manager.</param>
    /// <param name="jwtService">The JWT service.</param>
    /// <param name="userTenantMembershipService">The user tenant membership service.</param>
    public AuthResponseService(
        ILogger<AuthResponseService> logger,
        UserManager<ApplicationUser> userManager,
        IJwtService jwtService,
        IUserTenantMembershipService userTenantMembershipService)
    {
        _logger = logger;
        _userManager = userManager;
        _jwtService = jwtService;
        _userTenantMembershipService = userTenantMembershipService;
    }

    /// <inheritdoc/>
    public async Task<Result<AuthResponse>> GenerateAuthResponseAsync(
        ApplicationUser user,
        string? ipAddress = null,
        string? userAgent = null,
        VerificationChallengeResponse? twoFactorChallenge = null,
        CancellationToken cancellationToken = default)
    {
        if (twoFactorChallenge != null)
        {
            AuthResponse twoFactorResponse = new AuthResponse
            {
                TwoFactorRequired = true,
                TwoFactorExpiresAt = twoFactorChallenge.ExpiresAt,
                TwoFactorResendAvailableAt = twoFactorChallenge.ResendAvailableAt,
                AccessToken = string.Empty,
                RefreshToken = string.Empty,
                ExpiresAt = DateTime.UtcNow,
                User = new UserInfo
                {
                    UserId = user.Id,
                    UserName = user.UserName!,
                    Email = user.Email!,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Roles = []
                }
            };

            return Result.Ok(twoFactorResponse);
        }

        // Detached (no Active memberships) is a supported state — do not auto-mint a personal tenant
        // on login or refresh. Users create a workspace explicitly via IPersonalWorkspaceService.

        IList<string> globalRoles = await _userManager.GetRolesAsync(user);

        Guid? tenantId = null;
        string? tenantRole = null;
        Result<UserTenantMembership?> currentTenantResult = await _userTenantMembershipService.GetCurrentTenantAsync(user.Id, cancellationToken);

        if (currentTenantResult.IsSuccess && currentTenantResult.Value != null)
        {
            UserTenantMembership tenantMembership = currentTenantResult.Value;
            tenantId = tenantMembership.TenantId;
            tenantRole = tenantMembership.Role;

            await _userTenantMembershipService.SwitchTenantAsync(user.Id, tenantId.Value, cancellationToken);

            _logger.LogDebug("User {UserId} logging in with tenant context: TenantId={TenantId}, TenantRole={TenantRole}",
                user.Id, tenantId, tenantRole);
        }
        else
        {
            _logger.LogInformation(
                "User {UserId} has no active tenant memberships (Detached or suspended-only)",
                user.Id);
        }

        List<string> combinedRoles = new List<string>(globalRoles);

        if (!string.IsNullOrEmpty(tenantRole) && !combinedRoles.Contains(tenantRole))
        {
            combinedRoles.Add(tenantRole);
        }

        Result<RefreshToken> refreshTokenResult = await _jwtService.GenerateAndStoreRefreshTokenAsync(
            user.Id,
            ipAddress,
            userAgent,
            tenantId,
            cancellationToken);
        if (refreshTokenResult.IsFailed)
        {
            _logger.LogError("Failed to generate refresh token for user {UserId}", user.Id);
            return Result.Fail("Failed to generate refresh token");
        }

        RefreshToken refreshToken = refreshTokenResult.Value;

        Result<string> tokenResult = await _jwtService.GenerateAccessTokenAsync(
            user, combinedRoles, refreshToken.SessionId, tenantId, tenantRole, cancellationToken);
        if (tokenResult.IsFailed)
        {
            _logger.LogError("Failed to generate access token for user {UserId}", user.Id);
            return Result.Fail("Failed to generate authentication token");
        }

        AuthResponse response = new AuthResponse
        {
            AccessToken = tokenResult.Value,
            RefreshToken = refreshToken.Token,
            ExpiresAt = refreshToken.ExpiresAt,
            User = new UserInfo
            {
                UserId = user.Id,
                UserName = user.UserName!,
                Email = user.Email!,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Roles = combinedRoles
            }
        };

        return Result.Ok(response);
    }

    /// <inheritdoc/>
    public async Task<Result<AuthResponse>> GenerateAuthResponseForTenantAsync(
        ApplicationUser user,
        Guid tenantId,
        string tenantRole,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        IList<string> globalRoles = await _userManager.GetRolesAsync(user);

        List<string> combinedRoles = new List<string>(globalRoles);
        if (!string.IsNullOrEmpty(tenantRole) && !combinedRoles.Contains(tenantRole))
        {
            combinedRoles.Add(tenantRole);
        }

        Result<RefreshToken> refreshTokenResult = await _jwtService.GenerateAndStoreRefreshTokenAsync(
            user.Id,
            ipAddress,
            userAgent,
            tenantId,
            cancellationToken);
        if (refreshTokenResult.IsFailed)
        {
            _logger.LogError("Failed to generate refresh token for user {UserId} during tenant switch", user.Id);
            return Result.Fail("Failed to generate refresh token");
        }

        RefreshToken refreshToken = refreshTokenResult.Value;

        Result<string> tokenResult = await _jwtService.GenerateAccessTokenAsync(
            user, combinedRoles, refreshToken.SessionId, tenantId, tenantRole, cancellationToken);
        if (tokenResult.IsFailed)
        {
            _logger.LogError("Failed to generate access token for user {UserId} during tenant switch", user.Id);
            return Result.Fail("Failed to generate authentication token");
        }

        AuthResponse response = new AuthResponse
        {
            AccessToken = tokenResult.Value,
            RefreshToken = refreshToken.Token,
            ExpiresAt = refreshToken.ExpiresAt,
            User = new UserInfo
            {
                UserId = user.Id,
                UserName = user.UserName!,
                Email = user.Email!,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Roles = combinedRoles
            }
        };

        return Result.Ok(response);
    }
}
