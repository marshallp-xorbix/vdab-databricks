using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for managing refresh tokens.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="RefreshTokenRepository"/> class.
/// </remarks>
/// <param name="_context">The database context.</param>
/// <param name="_logger">The logger instance.</param>
public class RefreshTokenRepository(ApplicationDbContext _context, ILogger<RefreshTokenRepository> _logger) : IRefreshTokenRepository
{

    /// <inheritdoc/>
    public async Task<RefreshToken> CreateAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
    {
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Created refresh token {TokenId} for user {UserId}",
            refreshToken.Id, refreshToken.UserId);

        return refreshToken;
    }

    /// <inheritdoc/>
    public async Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        return await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == token, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<RefreshToken?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Id == id, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<RefreshTokenRevokeInfo?> GetRevokeInfoByIdAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        return await _context.RefreshTokens
            .AsNoTracking()
            .Where(rt => rt.Id == id)
            .Select(rt => new RefreshTokenRevokeInfo
            {
                Id = rt.Id,
                UserId = rt.UserId,
                SessionId = rt.SessionId,
                TenantId = rt.TenantId,
                IsRevoked = rt.IsRevoked,
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> RevokeAsync(string token, CancellationToken cancellationToken = default)
    {
        RefreshToken? refreshToken = await GetByTokenAsync(token, cancellationToken);

        if (refreshToken == null)
        {
            _logger.LogWarning("Attempted to revoke non-existent token");
            return false;
        }

        if (refreshToken.IsRevoked)
        {
            _logger.LogWarning("Attempted to revoke already revoked token {TokenId}", refreshToken.Id);
            return false;
        }

        refreshToken.IsRevoked = true;
        refreshToken.RevokedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Revoked refresh token {TokenId} for user {UserId}",
            refreshToken.Id, refreshToken.UserId);

        return true;
    }

    /// <inheritdoc/>
    public async Task<int> RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        List<RefreshToken> activeTokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync(cancellationToken);

        if (activeTokens.Count == 0)
        {
            return 0;
        }

        int revokedCount = 0;
        DateTime now = DateTime.UtcNow;

        foreach (RefreshToken token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = now;
            revokedCount++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Revoked {Count} refresh tokens for user {UserId}",
            revokedCount, userId);

        return revokedCount;
    }

    /// <inheritdoc/>
    public async Task<int> RevokeAllForUserAndTenantAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        List<RefreshToken> activeTokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && rt.TenantId == tenantId && !rt.IsRevoked)
            .ToListAsync(cancellationToken);

        if (activeTokens.Count == 0)
        {
            return 0;
        }

        int revokedCount = 0;
        DateTime now = DateTime.UtcNow;

        foreach (RefreshToken token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = now;
            revokedCount++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Revoked {Count} refresh tokens for user {UserId} in tenant {TenantId}",
            revokedCount,
            userId,
            tenantId);

        return revokedCount;
    }

    /// <inheritdoc/>
    public async Task<RefreshToken> UpdateAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
    {
        _context.RefreshTokens.Update(refreshToken);
        await _context.SaveChangesAsync(cancellationToken);

        return refreshToken;
    }

    /// <inheritdoc/>
    public async Task<bool> RevokeByIdAsync(int tokenId, CancellationToken cancellationToken = default)
    {
        RefreshToken? refreshToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Id == tokenId, cancellationToken);

        if (refreshToken == null)
        {
            _logger.LogWarning("Attempted to revoke non-existent token {TokenId}", tokenId);
            return false;
        }

        if (refreshToken.IsRevoked)
        {
            _logger.LogWarning("Attempted to revoke already revoked token {TokenId}", tokenId);
            return false;
        }

        refreshToken.IsRevoked = true;
        refreshToken.RevokedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Revoked refresh token {TokenId} for user {UserId}", tokenId, refreshToken.UserId);
        return true;
    }

    /// <inheritdoc/>
    public async Task<List<RefreshToken>> GetTokensMissingGeoDataAsync(Guid userId, List<int> tokenIds, CancellationToken cancellationToken = default)
    {
        return await _context.RefreshTokens
            .Where(rt => rt.UserId == userId
                && tokenIds.Contains(rt.Id)
                && rt.IpAddress != null
                && rt.City == null)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> TryClaimRotationAsync(int tokenId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;

        // Atomic guarded update: only one concurrent caller wins (rows-affected == 1).
        int rowsAffected = await _context.RefreshTokens
            .Where(rt => rt.Id == tokenId && !rt.IsRevoked)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.IsRevoked, true)
                .SetProperty(t => t.RevokedAt, now), cancellationToken);

        return rowsAffected == 1;
    }

    /// <inheritdoc/>
    public async Task<int> RevokeSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        DateTime now = DateTime.UtcNow;

        int rowsAffected = await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && rt.SessionId == sessionId && !rt.IsRevoked)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.IsRevoked, true)
                .SetProperty(t => t.RevokedAt, now), cancellationToken);

        if (rowsAffected > 0)
        {
            _logger.LogWarning("Revoked entire session {SessionId} for user {UserId} ({Count} tokens)",
                sessionId, userId, rowsAffected);
        }

        return rowsAffected;
    }

    /// <inheritdoc/>
    public async Task<bool> HasActiveSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        DateTime nowUtc = DateTime.UtcNow;

        return await _context.RefreshTokens
            .AsNoTracking()
            .AnyAsync(
                rt => rt.UserId == userId
                    && rt.SessionId == sessionId
                    && !rt.IsRevoked
                    && rt.ExpiresAt > nowUtc,
                cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<(List<GroupedSessionRow> Sessions, int TotalCount)> GetPaginatedGroupedSessionsAsync(
        Guid userId,
        int skip,
        int take,
        bool activeOnly,
        Guid? tenantId = null,
        CancellationToken cancellationToken = default)
    {
        DateTime nowUtc = DateTime.UtcNow;

        IQueryable<RefreshToken> tokenQuery = _context.RefreshTokens
            .Where(rt => rt.UserId == userId);

        // Tenant-admin views must not disclose cross-tenant or legacy (null TenantId) sessions.
        if (tenantId.HasValue)
        {
            tokenQuery = tokenQuery.Where(rt => rt.TenantId == tenantId.Value);
        }

        // Group all tokens for the user by SessionId. Aggregate dates from every token in the
        // chain; pick device/location from the latest token (highest CreatedAt) since that's
        // the live one (or the last one before revocation).
        var groupQuery = tokenQuery
            .GroupBy(rt => rt.SessionId)
            .Select(g => new
            {
                SessionId = g.Key,
                LiveTokenId = g.OrderByDescending(rt => rt.CreatedAt).Select(rt => rt.Id).First(),
                FirstSeenAt = g.Min(rt => rt.CreatedAt),
                LastActivityAt = g.Max(rt => rt.CreatedAt),
                ExpiresAt = g.Max(rt => rt.ExpiresAt),
                // A session is alive if any token in the chain is still valid.
                IsAlive = g.Any(rt => !rt.IsRevoked && rt.ExpiresAt > nowUtc)
            });

        if (activeOnly)
        {
            groupQuery = groupQuery.Where(g => g.IsAlive);
        }

        int totalCount = await groupQuery.CountAsync(cancellationToken);

        var page = await groupQuery
            .OrderByDescending(g => g.LastActivityAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        if (page.Count == 0)
        {
            return ([], totalCount);
        }

        // Hydrate the live tokens for the rows on the current page (single round trip).
        List<int> liveIds = page.Select(p => p.LiveTokenId).ToList();
        Dictionary<int, RefreshToken> liveTokens = await _context.RefreshTokens
            .Where(rt => liveIds.Contains(rt.Id))
            .ToDictionaryAsync(rt => rt.Id, cancellationToken);

        List<GroupedSessionRow> rows = page
            .Select(p =>
            {
                RefreshToken live = liveTokens[p.LiveTokenId];
                return new GroupedSessionRow
                {
                    SessionId = p.SessionId,
                    LiveTokenId = p.LiveTokenId,
                    FirstSeenAt = p.FirstSeenAt,
                    LastActivityAt = p.LastActivityAt,
                    ExpiresAt = p.ExpiresAt,
                    IsRevoked = live.IsRevoked,
                    RevokedAt = live.RevokedAt,
                    IpAddress = live.IpAddress,
                    UserAgent = live.UserAgent,
                    City = live.City,
                    Country = live.Country,
                    Region = live.Region
                };
            })
            .ToList();

        return (rows, totalCount);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && rt.ReplacedByTokenId != null)
            .ExecuteUpdateAsync(
                s => s.SetProperty(rt => rt.ReplacedByTokenId, (int?)null),
                cancellationToken);

        return await _context.RefreshTokens
            .Where(rt => rt.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
