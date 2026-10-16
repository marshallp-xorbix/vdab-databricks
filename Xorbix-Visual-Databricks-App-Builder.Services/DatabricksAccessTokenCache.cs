using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// HybridCache-backed encrypted cache for Databricks access tokens.
/// </summary>
public class DatabricksAccessTokenCache : IDatabricksAccessTokenCache
{
    private const string KeyPrefix = "accessToken";
    private const int DefaultAccessTokenTtlMinutes = 60;

    private readonly HybridCache _cache;
    private readonly IEncryptionHelper _encryption;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly ILogger<DatabricksAccessTokenCache> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="DatabricksAccessTokenCache"/> class.
    /// </summary>
    public DatabricksAccessTokenCache(
        HybridCache cache,
        IEncryptionHelper encryption,
        IHostEnvironment hostEnvironment,
        ILogger<DatabricksAccessTokenCache> logger)
    {
        _cache = cache;
        _encryption = encryption;
        _hostEnvironment = hostEnvironment;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<string?> GetOrCreateAsync(
        Guid userId,
        int workspaceConnectionId,
        int? accessTokenTtlMinutes,
        Func<CancellationToken, Task<string?>> factory,
        CancellationToken cancellationToken = default)
    {
        if (userId == Guid.Empty || workspaceConnectionId <= 0)
        {
            return null;
        }

        var key = BuildKey(userId, workspaceConnectionId);
        var entryOptions = BuildEntryOptions(accessTokenTtlMinutes);
        var cacheMiss = false;
        string encryptedToken = await _cache.GetOrCreateAsync(
            key,
            async cancel =>
            {
                cacheMiss = true;
                string? token = await factory(cancel);
                if (string.IsNullOrWhiteSpace(token))
                {
                    _logger.LogWarning("Databricks access token factory returned empty token for key {CacheKey}. Value was null/empty.", key);
                    return string.Empty;
                }

                _logger.LogDebug(
                    "Databricks access token factory produced token for key {CacheKey}. Length={TokenLength}, Preview={TokenPreview}",
                    key,
                    token.Length,
                    MaskToken(token));

                _logger.LogInformation("Databricks access token cache miss for key {CacheKey}; creating and caching token", key);
                return _encryption.Encrypt(token);
            },
            entryOptions,
            cancellationToken: cancellationToken);

        if (!cacheMiss)
        {
            _logger.LogDebug("Databricks access token cache hit for key {CacheKey}", key);
        }

        if (string.IsNullOrWhiteSpace(encryptedToken))
        {
            _logger.LogDebug("Databricks access token not cached because token factory returned empty value for key {CacheKey}", key);
            await RemoveAsync(userId, workspaceConnectionId, cancellationToken);
            return null;
        }

        var decrypted = _encryption.Decrypt(encryptedToken);
        if (string.IsNullOrWhiteSpace(decrypted))
        {
            _logger.LogWarning("Failed to decrypt cached Databricks access token for key {CacheKey}", key);
            await RemoveAsync(userId, workspaceConnectionId, cancellationToken);
            return null;
        }

        return decrypted;
    }

    /// <inheritdoc/>
    public async Task SetAsync(
        Guid userId,
        int workspaceConnectionId,
        int? accessTokenTtlMinutes,
        string accessToken,
        CancellationToken cancellationToken = default)
    {
        if (userId == Guid.Empty || workspaceConnectionId <= 0 || string.IsNullOrWhiteSpace(accessToken))
        {
            return;
        }

        var key = BuildKey(userId, workspaceConnectionId);
        var entryOptions = BuildEntryOptions(accessTokenTtlMinutes);
        var encrypted = _encryption.Encrypt(accessToken);
        _logger.LogDebug(
            "Attempting to cache Databricks access token for key {CacheKey}. Length={TokenLength}, Preview={TokenPreview}",
            key,
            accessToken.Length,
            MaskToken(accessToken));
        await _cache.SetAsync(key, encrypted, entryOptions, cancellationToken: cancellationToken);
        _logger.LogDebug("Databricks access token cached for key {CacheKey} with TTL minutes {TtlMinutes}",
            key,
            accessTokenTtlMinutes.GetValueOrDefault(DefaultAccessTokenTtlMinutes));
    }

    /// <inheritdoc/>
    public async Task RemoveAsync(Guid userId, int workspaceConnectionId, CancellationToken cancellationToken = default)
    {
        if (userId == Guid.Empty || workspaceConnectionId <= 0)
        {
            return;
        }

        var key = BuildKey(userId, workspaceConnectionId);
        await _cache.RemoveAsync(key, cancellationToken);
        _logger.LogDebug("Databricks access token cache entry removed for key {CacheKey}", key);
    }

    private string BuildKey(Guid userId, int workspaceConnectionId)
    {
        return $"{KeyPrefix}:{_hostEnvironment.EnvironmentName}:{userId}:{workspaceConnectionId}";
    }

    private static HybridCacheEntryOptions BuildEntryOptions(int? accessTokenTtlMinutes)
    {
        var ttl = accessTokenTtlMinutes.GetValueOrDefault(DefaultAccessTokenTtlMinutes);
        if (ttl <= 0)
        {
            ttl = DefaultAccessTokenTtlMinutes;
        }

        var ttlSpan = TimeSpan.FromMinutes(ttl);
        return new HybridCacheEntryOptions
        {
            Expiration = ttlSpan,
            LocalCacheExpiration = ttlSpan
        };
    }

    private static string MaskToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return "(empty)";
        }

        if (token.Length <= 10)
        {
            return "***";
        }

        return $"{token[..6]}...{token[^4..]}";
    }
}
