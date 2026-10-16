using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Validates JWT access tokens against the user's current security stamp and active session state.
/// </summary>
public class AccessTokenSessionValidator : IAccessTokenSessionValidator
{
    /// <summary>
    /// How long a session validation outcome (success or failure) may be reused without hitting the database.
    /// Revocation takes effect within this window at worst; failures are monotonic for a given cache key.
    /// </summary>
    internal static readonly TimeSpan ValidationCacheDuration = TimeSpan.FromSeconds(5);

    private readonly ILogger<AccessTokenSessionValidator> _logger;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IMemoryCache _memoryCache;
    private readonly IAccountAccessPolicy _accountAccessPolicy;

    /// <summary>
    /// Initializes a new instance of the <see cref="AccessTokenSessionValidator"/> class.
    /// </summary>
    /// <param name="logger">Logger instance.</param>
    /// <param name="userManager">User manager instance.</param>
    /// <param name="refreshTokenRepository">Refresh token repository instance.</param>
    /// <param name="memoryCache">In-memory cache for short-TTL validation outcomes.</param>
    /// <param name="accountAccessPolicy">Whether the account may authenticate.</param>
    public AccessTokenSessionValidator(
        ILogger<AccessTokenSessionValidator> logger,
        UserManager<ApplicationUser> userManager,
        IRefreshTokenRepository refreshTokenRepository,
        IMemoryCache memoryCache,
        IAccountAccessPolicy accountAccessPolicy)
    {
        _logger = logger;
        _userManager = userManager;
        _refreshTokenRepository = refreshTokenRepository;
        _memoryCache = memoryCache;
        _accountAccessPolicy = accountAccessPolicy;
    }

    /// <inheritdoc/>
    public async Task<bool> ValidateAsync(
        Guid userId,
        string? securityStampClaim,
        string? sessionIdClaim,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(securityStampClaim) || string.IsNullOrWhiteSpace(sessionIdClaim))
        {
            _logger.LogWarning(
                "Access token for user {UserId} is missing session binding claims",
                userId);
            return false;
        }

        if (!Guid.TryParse(sessionIdClaim, out Guid sessionId))
        {
            _logger.LogWarning(
                "Access token for user {UserId} has invalid session id claim",
                userId);
            return false;
        }

        string cacheKey = BuildCacheKey(userId, sessionId, securityStampClaim);
        if (_memoryCache.TryGetValue(cacheKey, out bool cached))
        {
            return cached;
        }

        bool isValid = await ValidateAgainstStoreAsync(
            userId,
            sessionId,
            securityStampClaim,
            cancellationToken);

        _memoryCache.Set(
            cacheKey,
            isValid,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ValidationCacheDuration,
            });

        return isValid;
    }

    private async Task<bool> ValidateAgainstStoreAsync(
        Guid userId,
        Guid sessionId,
        string securityStampClaim,
        CancellationToken cancellationToken)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
        if (!_accountAccessPolicy.CanAuthenticate(user))
        {
            _logger.LogWarning("Access token validation failed: user {UserId} not found or inactive", userId);
            return false;
        }

        if (!string.Equals(user!.SecurityStamp, securityStampClaim, StringComparison.Ordinal))
        {
            _logger.LogWarning("Access token security stamp mismatch for user {UserId}", userId);
            return false;
        }

        bool hasActiveSession = await _refreshTokenRepository.HasActiveSessionAsync(
            userId, sessionId, cancellationToken);
        if (!hasActiveSession)
        {
            _logger.LogWarning(
                "Access token session {SessionId} is no longer active for user {UserId}",
                sessionId, userId);
            return false;
        }

        return true;
    }

    /// <summary>
    /// Builds the cache key for a session validation outcome.
    /// </summary>
    internal static string BuildCacheKey(Guid userId, Guid sessionId, string securityStamp) =>
        $"session-valid:{userId}:{sessionId}:{securityStamp}";
}
