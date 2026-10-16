using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for generating and validating JWT tokens.
/// </summary>
public class JwtService : IJwtService
{
    private readonly JwtConfiguration _jwtConfig;
    private readonly ILogger<JwtService> _logger;
    private readonly SymmetricSecurityKey _signingKey;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IGeoLocationService _geoLocationService;

    /// <summary>
    /// Initializes a new instance of the <see cref="JwtService"/> class.
    /// </summary>
    /// <param name="jwtConfig">JWT configuration options.</param>
    /// <param name="logger">Logger instance.</param>
    /// <param name="refreshTokenRepository">Refresh token repository.</param>
    /// <param name="userManager">User manager.</param>
    /// <param name="geoLocationService">Geolocation service.</param>
    public JwtService(
        IOptions<JwtConfiguration> jwtConfig,
        ILogger<JwtService> logger,
        IRefreshTokenRepository refreshTokenRepository,
        UserManager<ApplicationUser> userManager,
        IGeoLocationService geoLocationService)
    {
        _jwtConfig = jwtConfig.Value;
        _logger = logger;
        _signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtConfig.SecretKey));
        _refreshTokenRepository = refreshTokenRepository;
        _userManager = userManager;
        _geoLocationService = geoLocationService;
    }

    /// <inheritdoc/>
    public async Task<Result<string>> GenerateAccessTokenAsync(
        ApplicationUser user,
        IList<string> roles,
        Guid sessionId,
        Guid? tenantId = null,
        string? tenantRole = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(user.SecurityStamp))
            {
                _logger.LogError(
                    "User {UserId} has no security stamp; cannot mint a bound access token",
                    user.Id);
                return Result.Fail("Failed to generate access token");
            }

            List<Claim> claims =
            [
                // Standard JWT claims
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),

                // Standard identity claims
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.UserName ?? string.Empty),
                new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                new Claim(ClaimTypes.GivenName, user.FirstName),
                new Claim(ClaimTypes.Surname, user.LastName),

                // Session binding — validated on every authenticated request
                new Claim(AuthClaimTypes.SecurityStamp, user.SecurityStamp),
                new Claim(AuthClaimTypes.SessionId, sessionId.ToString()),
            ];

            // Add role claims (includes both global Administrator from Identity and tenant-specific role)
            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            // Add tenant context claims if user has a tenant membership
            if (tenantId.HasValue)
            {
                claims.Add(new Claim(TenantClaimTypes.TenantId, tenantId.Value.ToString()));
            }

            if (!string.IsNullOrEmpty(tenantRole))
            {
                claims.Add(new Claim(TenantClaimTypes.TenantRole, tenantRole));
            }

            SigningCredentials credentials = new(_signingKey, SecurityAlgorithms.HmacSha256);

            JwtSecurityToken token = new(
                issuer: _jwtConfig.Issuer,
                audience: _jwtConfig.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_jwtConfig.ExpirationMinutes),
                signingCredentials: credentials
            );

            string tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            _logger.LogDebug("Generated JWT for user {UserId} with tenant {TenantId} and roles [{Roles}]", 
                user.Id, tenantId?.ToString() ?? "none", string.Join(", ", roles));

            return await Task.FromResult(Result.Ok(tokenString));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating JWT token for user {UserId}", user.Id);
            return Result.Fail("Failed to generate access token");
        }
    }

    /// <summary>
    /// Generates a cryptographically secure random refresh token.
    /// </summary>
    /// <returns>A Base64-encoded refresh token string.</returns>
    private static string GenerateRefreshToken()
    {
        byte[] randomNumber = new byte[32];
        using RandomNumberGenerator rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    /// <inheritdoc/>
    public async Task<Result<RefreshToken>> GenerateAndStoreRefreshTokenAsync(
        Guid userId,
        string? ipAddress = null,
        string? userAgent = null,
        Guid? tenantId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            string token = GenerateRefreshToken();

            RefreshToken refreshToken = new()
            {
                Token = token,
                UserId = userId,
                TenantId = tenantId,
                SessionId = Guid.NewGuid(),
                ExpiresAt = DateTime.UtcNow.AddDays(_jwtConfig.RefreshTokenExpirationDays),
                CreatedAt = DateTime.UtcNow,
                IpAddress = ipAddress,
                UserAgent = userAgent
            };

            // Resolve geolocation from IP address
            if (!string.IsNullOrWhiteSpace(ipAddress))
            {
                cancellationToken.ThrowIfCancellationRequested();
                (string? city, string? country, string? region) = _geoLocationService.Resolve(ipAddress);
                refreshToken.City = city;
                refreshToken.Country = country;
                refreshToken.Region = region;
            }

            await _refreshTokenRepository.CreateAsync(refreshToken, cancellationToken);

            _logger.LogInformation(
                "Generated and stored refresh token for user {UserId} in tenant {TenantId}",
                userId,
                tenantId);

            return Result.Ok(refreshToken);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating and storing refresh token for user {UserId}", userId);
            return Result.Fail<RefreshToken>("Failed to generate refresh token");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<RefreshToken>> ValidateRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        try
        {
            RefreshToken? refreshToken = await _refreshTokenRepository.GetByTokenAsync(token, cancellationToken);

            if (refreshToken == null)
            {
                _logger.LogWarning("Refresh token not found");
                return Result.Fail<RefreshToken>("Invalid refresh token");
            }

            if (refreshToken.IsRevoked)
            {
                _logger.LogWarning("Attempted to use revoked refresh token {TokenId}", refreshToken.Id);
                return Result.Fail<RefreshToken>("Refresh token has been revoked");
            }

            if (refreshToken.IsExpired)
            {
                _logger.LogWarning("Attempted to use expired refresh token {TokenId}", refreshToken.Id);
                return Result.Fail<RefreshToken>("Refresh token has expired");
            }

            return Result.Ok(refreshToken);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating refresh token");
            return Result.Fail<RefreshToken>("Failed to validate refresh token");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> RevokeRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        try
        {
            bool success = await _refreshTokenRepository.RevokeAsync(token, cancellationToken);

            if (!success)
            {
                return Result.Fail("Failed to revoke refresh token");
            }

            return Result.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking refresh token");
            return Result.Fail("Failed to revoke refresh token");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<int>> RevokeAllUserRefreshTokensAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            int count = await _refreshTokenRepository.RevokeAllForUserAsync(userId, cancellationToken);
            return Result.Ok(count);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking all refresh tokens for user {UserId}", userId);
            return Result.Fail<int>("Failed to revoke refresh tokens");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<int>> RevokeAllUserRefreshTokensForTenantAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            int count = await _refreshTokenRepository.RevokeAllForUserAndTenantAsync(
                userId,
                tenantId,
                cancellationToken);
            return Result.Ok(count);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error revoking refresh tokens for user {UserId} in tenant {TenantId}",
                userId,
                tenantId);
            return Result.Fail<int>("Failed to revoke refresh tokens");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<(string AccessToken, RefreshToken RefreshToken)>> RefreshAccessTokenAsync(
        string refreshToken,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            RefreshToken? presentedToken = await _refreshTokenRepository.GetByTokenAsync(refreshToken, cancellationToken);

            if (presentedToken == null)
            {
                _logger.LogWarning("Refresh token not found");
                return Result.Fail<(string, RefreshToken)>("Invalid refresh token");
            }

            if (presentedToken.IsExpired)
            {
                _logger.LogWarning("Attempted to use expired refresh token {TokenId}", presentedToken.Id);
                return Result.Fail<(string, RefreshToken)>("Refresh token has expired");
            }

            if (presentedToken.IsRevoked)
            {
                return await HandleRevokedRefreshTokenAsync(presentedToken, cancellationToken);
            }

            // Atomic claim: only one concurrent caller wins. Losers fall back to grace-window logic.
            bool claimed = await _refreshTokenRepository.TryClaimRotationAsync(presentedToken.Id, cancellationToken);

            if (!claimed)
            {
                return await TryReturnConcurrentReplacementAsync(refreshToken, presentedToken.Id, cancellationToken);
            }

            return await CreateRotatedRefreshTokenAsync(presentedToken, ipAddress, userAgent, cancellationToken);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing access token");
            return Result.Fail<(string, RefreshToken)>("Failed to refresh access token");
        }
    }

    /// <summary>
    /// Handles a refresh request that presented an already-revoked token. Within the rotation
    /// grace window the request is treated as a benign race and the existing replacement is
    /// returned; otherwise it is treated as token reuse and the entire session is revoked.
    /// </summary>
    private async Task<Result<(string AccessToken, RefreshToken RefreshToken)>> HandleRevokedRefreshTokenAsync(
        RefreshToken presentedToken, CancellationToken cancellationToken)
    {
        // Window during which a revoked-but-just-rotated token is still treated as a benign
        // race rather than reuse. Keep this short — long enough to cover normal client retry,
        // short enough that real token theft is still detected.
        TimeSpan rotationGraceWindow = TimeSpan.FromSeconds(30);

        bool withinGraceWindow = presentedToken.ReplacedByTokenId.HasValue
            && presentedToken.RevokedAt.HasValue
            && DateTime.UtcNow - presentedToken.RevokedAt.Value <= rotationGraceWindow;

        if (withinGraceWindow)
        {
            Result<(string, RefreshToken)> graceResult = await TryReturnExistingReplacementAsync(
                presentedToken.ReplacedByTokenId!.Value, presentedToken.Id, "grace window", cancellationToken);

            if (graceResult.IsSuccess)
            {
                return graceResult;
            }
        }

        // Outside the grace window (or no usable replacement on file): treat as token reuse.
        // Revoke every token in this session so the attacker is locked out and the legitimate
        // user is forced to re-authenticate.
        _logger.LogWarning(
            "Detected refresh token reuse for user {UserId}; revoking entire session {SessionId}",
            presentedToken.UserId, presentedToken.SessionId);

        await _refreshTokenRepository.RevokeSessionAsync(
            presentedToken.UserId, presentedToken.SessionId, cancellationToken);

        return Result.Fail<(string, RefreshToken)>("Refresh token has been revoked");
    }

    /// <summary>
    /// Caller lost the atomic rotation claim. Re-read the presented token and follow its
    /// replacement so the loser still gets a usable access/refresh pair.
    /// </summary>
    private async Task<Result<(string AccessToken, RefreshToken RefreshToken)>> TryReturnConcurrentReplacementAsync(
        string presentedRefreshToken, int presentedTokenId, CancellationToken cancellationToken)
    {
        RefreshToken? rotated = await _refreshTokenRepository.GetByTokenAsync(presentedRefreshToken, cancellationToken);

        if (rotated?.ReplacedByTokenId is int replacementId)
        {
            Result<(string, RefreshToken)> result = await TryReturnExistingReplacementAsync(
                replacementId, presentedTokenId, "concurrent rotation", cancellationToken);

            if (result.IsSuccess)
            {
                return result;
            }
        }

        return Result.Fail<(string, RefreshToken)>("Failed to refresh access token");
    }

    /// <summary>
    /// Loads <paramref name="replacementId"/> and, if it is still usable, mints a fresh access
    /// token bound to the same user. Used by both the grace-window and lost-race paths.
    /// </summary>
    private async Task<Result<(string AccessToken, RefreshToken RefreshToken)>> TryReturnExistingReplacementAsync(
        int replacementId, int losingTokenId, string reason, CancellationToken cancellationToken)
    {
        RefreshToken? replacement = await _refreshTokenRepository.GetByIdAsync(replacementId, cancellationToken);
        if (replacement == null || replacement.IsRevoked || replacement.IsExpired)
        {
            return Result.Fail<(string, RefreshToken)>("No usable replacement");
        }

        Result<string> accessTokenResult = await BuildAccessTokenForUserAsync(
            replacement.UserId, replacement.SessionId, cancellationToken);
        if (accessTokenResult.IsFailed)
        {
            return Result.Fail<(string, RefreshToken)>(accessTokenResult.Errors);
        }

        _logger.LogInformation(
            "Refresh token {TokenId} was already rotated ({Reason}); returning replacement {ReplacementId}",
            losingTokenId, reason, replacement.Id);

        return Result.Ok((accessTokenResult.Value, replacement));
    }

    /// <summary>
    /// Caller won the atomic rotation claim — <paramref name="claimedToken"/> is now revoked
    /// in the database. Mint a new refresh token in the same session and link them.
    /// </summary>
    private async Task<Result<(string AccessToken, RefreshToken RefreshToken)>> CreateRotatedRefreshTokenAsync(
        RefreshToken claimedToken, string? ipAddress, string? userAgent, CancellationToken cancellationToken)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(claimedToken.UserId.ToString());
        if (user == null)
        {
            _logger.LogError("User {UserId} not found for refresh token", claimedToken.UserId);
            return Result.Fail<(string, RefreshToken)>("User not found");
        }

        IList<string> roles = await _userManager.GetRolesAsync(user);

        Result<string> accessTokenResult = await GenerateAccessTokenAsync(
            user, roles, claimedToken.SessionId, cancellationToken: cancellationToken);
        if (accessTokenResult.IsFailed)
        {
            return Result.Fail<(string, RefreshToken)>(accessTokenResult.Errors);
        }

        RefreshToken newRefreshToken = new()
        {
            Token = GenerateRefreshToken(),
            UserId = claimedToken.UserId,
            TenantId = claimedToken.TenantId,
            SessionId = claimedToken.SessionId,
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtConfig.RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            UserAgent = userAgent
        };

        if (!string.IsNullOrWhiteSpace(ipAddress))
        {
            cancellationToken.ThrowIfCancellationRequested();
            (string? city, string? country, string? region) = _geoLocationService.Resolve(ipAddress);
            newRefreshToken.City = city;
            newRefreshToken.Country = country;
            newRefreshToken.Region = region;
        }

        RefreshToken createdToken = await _refreshTokenRepository.CreateAsync(newRefreshToken, cancellationToken);

        // Reload the just-revoked token so we link it to the new replacement without
        // overwriting the IsRevoked/RevokedAt set atomically by TryClaimRotationAsync.
        RefreshToken? revokedForLink = await _refreshTokenRepository.GetByIdAsync(claimedToken.Id, cancellationToken);
        if (revokedForLink != null)
        {
            revokedForLink.ReplacedByTokenId = createdToken.Id;
            await _refreshTokenRepository.UpdateAsync(revokedForLink, cancellationToken);
        }

        _logger.LogInformation("Refreshed access token for user {UserId}, rotated refresh token in session {SessionId}",
            user.Id, claimedToken.SessionId);

        return Result.Ok((accessTokenResult.Value, createdToken));
    }

    /// <summary>
    /// Builds an access token for the user identified by <paramref name="userId"/> bound to
    /// <paramref name="sessionId"/>.
    /// </summary>
    private async Task<Result<string>> BuildAccessTokenForUserAsync(
        Guid userId, Guid sessionId, CancellationToken cancellationToken)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            _logger.LogError("User {UserId} not found while building access token", userId);
            return Result.Fail<string>("User not found");
        }

        IList<string> roles = await _userManager.GetRolesAsync(user);
        return await GenerateAccessTokenAsync(user, roles, sessionId, cancellationToken: cancellationToken);
    }
}