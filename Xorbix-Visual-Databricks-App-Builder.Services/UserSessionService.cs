using FluentResults;
using Microsoft.Extensions.Logging;
using UAParser;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing user sessions and enriching session metadata.
/// </summary>
public class UserSessionService : IUserSessionService
{
    private readonly ILogger<UserSessionService> _logger;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IGeoLocationService _geoLocationService;

    private static readonly Parser UaParser = Parser.GetDefault();

    /// <summary>
    /// Initializes a new instance of the <see cref="UserSessionService"/> class.
    /// </summary>
    /// <param name="logger">Logger instance.</param>
    /// <param name="refreshTokenRepository">Refresh token repository instance.</param>
    /// <param name="geoLocationService">Geolocation service instance.</param>
    public UserSessionService(
        ILogger<UserSessionService> logger,
        IRefreshTokenRepository refreshTokenRepository,
        IGeoLocationService geoLocationService)
    {
        _logger = logger;
        _refreshTokenRepository = refreshTokenRepository;
        _geoLocationService = geoLocationService;
    }

    /// <inheritdoc/>
    public async Task<Result<UserSessionsResponse>> GetUserSessionsAsync(
        Guid userId,
        int skip,
        int take,
        bool activeOnly = true,
        Guid? currentSessionId = null,
        Guid? tenantId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            (List<GroupedSessionRow> rows, int totalCount) = await _refreshTokenRepository
                .GetPaginatedGroupedSessionsAsync(userId, skip, take, activeOnly, tenantId, cancellationToken);

            await BackfillGeoLocationForGroupsAsync(userId, rows, cancellationToken);

            DateTime nowUtc = DateTime.UtcNow;
            List<UserSessionDto> sessions = rows
                .Select(r => MapGroupToSessionDto(r, nowUtc, currentSessionId))
                .ToList();

            UserSessionsResponse response = new UserSessionsResponse
            {
                Sessions = sessions,
                TotalCount = totalCount
            };

            return Result.Ok(response);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving sessions for user {UserId}", userId);
            return Result.Fail<UserSessionsResponse>("Failed to retrieve user sessions");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<RevokeSessionResponse>> RevokeSessionAsync(
        Guid userId,
        int sessionId,
        Guid revokedByUserId,
        Guid? callerSessionId = null,
        Guid? tenantId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Admin {AdminUserId} revoking session {SessionId} for user {UserId}",
                revokedByUserId, sessionId, userId);

            const string sessionNotFoundMessage = "Session {0} not found or already revoked";

            RefreshTokenRevokeInfo? refreshToken = await _refreshTokenRepository
                .GetRevokeInfoByIdAsync(sessionId, cancellationToken);
            if (refreshToken is null || refreshToken.UserId != userId)
            {
                return Result.Fail(new NotFoundError(string.Format(sessionNotFoundMessage, sessionId)));
            }

            if (tenantId.HasValue && refreshToken.TenantId != tenantId.Value)
            {
                return Result.Fail(new NotFoundError(string.Format(sessionNotFoundMessage, sessionId)));
            }

            bool revokedCurrentSession = callerSessionId.HasValue
                && callerSessionId.Value == refreshToken.SessionId;

            if (refreshToken.IsRevoked)
            {
                return Result.Ok(new RevokeSessionResponse
                {
                    RevokedCurrentSession = revokedCurrentSession
                });
            }

            int revokedCount = await _refreshTokenRepository.RevokeSessionAsync(
                userId, refreshToken.SessionId, cancellationToken);

            if (revokedCount == 0)
            {
                return Result.Fail(new NotFoundError(string.Format(sessionNotFoundMessage, sessionId)));
            }

            return Result.Ok(new RevokeSessionResponse
            {
                RevokedCurrentSession = revokedCurrentSession
            });
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking session {SessionId} for user {UserId}", sessionId, userId);
            return Result.Fail("Failed to revoke session");
        }
    }

    /// <summary>
    /// Backfills geolocation data for the live tokens behind the grouped session rows.
    /// Updates both the database and the in-memory rows so the response reflects the latest data.
    /// </summary>
    private async Task BackfillGeoLocationForGroupsAsync(Guid userId, List<GroupedSessionRow> rows, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        List<int> tokenIds = rows
            .Where(r => r.IpAddress != null && r.City == null)
            .Select(r => r.LiveTokenId)
            .ToList();

        if (tokenIds.Count == 0)
        {
            return;
        }

        List<RefreshToken> tokensToUpdate = await _refreshTokenRepository.GetTokensMissingGeoDataAsync(userId, tokenIds, cancellationToken);
        if (tokensToUpdate.Count == 0)
        {
            return;
        }

        Dictionary<int, (string? City, string? Country, string? Region)> resolved = new();

        foreach (RefreshToken token in tokensToUpdate)
        {
            cancellationToken.ThrowIfCancellationRequested();

            (string? city, string? country, string? region) = _geoLocationService.Resolve(token.IpAddress!);
            token.City = city;
            token.Country = country;
            token.Region = region;

            await _refreshTokenRepository.UpdateAsync(token, cancellationToken);
            resolved[token.Id] = (city, country, region);
        }

        // Mutate-in-place by rebuilding the row with resolved geo data.
        for (int i = 0; i < rows.Count; i++)
        {
            GroupedSessionRow original = rows[i];
            if (resolved.TryGetValue(original.LiveTokenId, out (string? City, string? Country, string? Region) geo))
            {
                rows[i] = new GroupedSessionRow
                {
                    SessionId = original.SessionId,
                    LiveTokenId = original.LiveTokenId,
                    FirstSeenAt = original.FirstSeenAt,
                    LastActivityAt = original.LastActivityAt,
                    ExpiresAt = original.ExpiresAt,
                    IsRevoked = original.IsRevoked,
                    RevokedAt = original.RevokedAt,
                    IpAddress = original.IpAddress,
                    UserAgent = original.UserAgent,
                    City = geo.City,
                    Country = geo.Country,
                    Region = geo.Region
                };
            }
        }
    }

    /// <summary>
    /// Maps a grouped session row to a UserSessionDto with parsed UserAgent info.
    /// </summary>
    private static UserSessionDto MapGroupToSessionDto(
        GroupedSessionRow row,
        DateTime nowUtc,
        Guid? currentSessionId)
    {
        string? browser = null;
        string? os = null;
        string? deviceType = null;

        if (!string.IsNullOrWhiteSpace(row.UserAgent))
        {
            ClientInfo clientInfo = UaParser.Parse(row.UserAgent);
            browser = FormatBrowser(clientInfo.UA);
            os = FormatOs(clientInfo.OS);
            deviceType = InferDeviceType(clientInfo.Device, clientInfo.OS);
        }

        bool isExpired = nowUtc >= row.ExpiresAt;
        bool isActive = !row.IsRevoked && !isExpired;

        return new UserSessionDto
        {
            SessionId = row.SessionId,
            Id = row.LiveTokenId,
            IpAddress = row.IpAddress,
            UserAgent = row.UserAgent,
            Browser = browser,
            OperatingSystem = os,
            DeviceType = deviceType,
            City = row.City,
            Country = row.Country,
            Region = row.Region,
            FirstSeenAt = row.FirstSeenAt,
            LastActivityAt = row.LastActivityAt,
            ExpiresAt = row.ExpiresAt,
            IsRevoked = row.IsRevoked,
            RevokedAt = row.RevokedAt,
            IsActive = isActive,
            IsCurrentSession = currentSessionId.HasValue && row.SessionId == currentSessionId.Value,
            IsExpired = isExpired
        };
    }

    /// <summary>
    /// Formats browser name and version from UAParser result.
    /// </summary>
    private static string FormatBrowser(UAParser.UserAgent ua)
    {
        if (string.IsNullOrWhiteSpace(ua.Family) || ua.Family == "Other")
        {
            return "Unknown Browser";
        }

        return string.IsNullOrWhiteSpace(ua.Major)
            ? ua.Family
            : $"{ua.Family} {ua.Major}";
    }

    /// <summary>
    /// Formats OS name and version from UAParser result.
    /// </summary>
    private static string FormatOs(OS osInfo)
    {
        if (string.IsNullOrWhiteSpace(osInfo.Family) || osInfo.Family == "Other")
        {
            return "Unknown OS";
        }

        return string.IsNullOrWhiteSpace(osInfo.Major)
            ? osInfo.Family
            : $"{osInfo.Family} {osInfo.Major}";
    }

    /// <summary>
    /// Infers device type from UAParser device and OS info.
    /// </summary>
    private static string InferDeviceType(Device device, OS osInfo)
    {
        string deviceFamily = device.Family?.ToLowerInvariant() ?? string.Empty;
        string osFamily = osInfo.Family?.ToLowerInvariant() ?? string.Empty;

        if (deviceFamily.Contains("spider") || deviceFamily.Contains("bot"))
        {
            return "Bot";
        }

        if (deviceFamily.Contains("iphone") || deviceFamily.Contains("android") ||
            osFamily.Contains("android") || osFamily.Contains("ios"))
        {
            return "Mobile";
        }

        if (deviceFamily.Contains("ipad") || deviceFamily.Contains("tablet"))
        {
            return "Tablet";
        }

        if (osFamily.Contains("windows") || osFamily.Contains("mac os") ||
            osFamily.Contains("linux") || osFamily.Contains("chrome os"))
        {
            return "Desktop";
        }

        return "Unknown";
    }
}
