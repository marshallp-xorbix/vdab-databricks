using System.Collections.Concurrent;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Models.Mapping;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services
{
    public class DatabricksConnectionService : IDatabricksConnectionService
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> TokenLocks = new();
        private readonly IDatabricksConnectionRepository _repository;
        private readonly IDatabricksUserTokenRepository _userTokenRepository;
        private readonly IDatabricksAccessTokenCache _accessTokenCache;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<DatabricksConnectionService> _logger;
        private readonly ITenantLimitService _tenantLimitService;
        private readonly ITenantResourceGuard _tenantResourceGuard;
        private readonly IDatabricksWorkspaceConnectionValidator _workspaceConnectionValidator;

        public DatabricksConnectionService(
            IDatabricksConnectionRepository repository,
            IDatabricksUserTokenRepository userTokenRepository,
            IDatabricksAccessTokenCache accessTokenCache,
            IHttpClientFactory httpClientFactory,
            ILogger<DatabricksConnectionService> logger,
            ITenantLimitService tenantLimitService,
            ITenantResourceGuard tenantResourceGuard,
            IDatabricksWorkspaceConnectionValidator workspaceConnectionValidator)
        {
            _repository = repository;
            _userTokenRepository = userTokenRepository;
            _accessTokenCache = accessTokenCache;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _tenantLimitService = tenantLimitService;
            _tenantResourceGuard = tenantResourceGuard;
            _workspaceConnectionValidator = workspaceConnectionValidator;
        }

        public async Task<Result<DatabricksConnectionDto?>> GetConnectionByWorkspaceAsync(string workspaceUrl, Guid tenantId)
        {
            if (string.IsNullOrEmpty(workspaceUrl))
            {
                return Result.Fail<DatabricksConnectionDto?>(new Error("Workspace URL cannot be empty."));
            }

            try
            {
                _logger.LogInformation("Attempting to retrieve connection for workspace: {WorkspaceUrl}", workspaceUrl);
                DatabricksConnection? connection = await _repository.GetByWorkspaceUrlAsync(workspaceUrl);

                if (connection == null)
                {
                    _logger.LogWarning("Connection not found for workspace: {WorkspaceUrl}", workspaceUrl);
                    return Result.Ok<DatabricksConnectionDto?>(null);
                }

                Result tenantGuardResult = _tenantResourceGuard.EnsureConnectionInTenant(connection, tenantId);
                if (tenantGuardResult.IsFailed)
                {
                    return Result.Fail<DatabricksConnectionDto?>(tenantGuardResult.Errors);
                }

                _logger.LogInformation("Successfully retrieved connection (PkId: {PkId}) for workspace: {WorkspaceUrl}", connection.PkId, workspaceUrl);
                return Result.Ok<DatabricksConnectionDto?>(connection.ToDto());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve connection for workspace: {WorkspaceUrl}", workspaceUrl);
                return Result.Fail<DatabricksConnectionDto?>(new ExceptionalError($"Failed to retrieve connection for {workspaceUrl}.", ex));
            }
        }

        public async Task<Result<(string ClientId, string ClientSecret)?>> GetCredentialsAsync(string workspaceUrl, Guid tenantId)
        {
            if (string.IsNullOrEmpty(workspaceUrl))
            {
                return Result.Fail<(string ClientId, string ClientSecret)?>(new Error("Workspace URL cannot be empty."));
            }

            try
            {
                _logger.LogInformation("Attempting to retrieve credentials for workspace: {WorkspaceUrl}", workspaceUrl);
                DatabricksConnection? connection = await _repository.GetByWorkspaceUrlAsync(workspaceUrl);

                if (connection == null)
                {
                    _logger.LogWarning("Credentials not found for workspace: {WorkspaceUrl}", workspaceUrl);
                    return Result.Ok<(string ClientId, string ClientSecret)?>(null);
                }

                Result tenantGuardResult = _tenantResourceGuard.EnsureConnectionInTenant(connection, tenantId);
                if (tenantGuardResult.IsFailed)
                {
                    return Result.Fail<(string ClientId, string ClientSecret)?>(tenantGuardResult.Errors);
                }

                (string ClientId, string ClientSecret) result = (connection.ClientId ?? "", connection.ClientSecret ?? "");
                _logger.LogInformation("Successfully retrieved credentials for workspace: {WorkspaceUrl}", workspaceUrl);
                return Result.Ok<(string ClientId, string ClientSecret)?>(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve credentials for workspace: {WorkspaceUrl}", workspaceUrl);
                return Result.Fail<(string ClientId, string ClientSecret)?>(new ExceptionalError($"Failed to retrieve credentials for {workspaceUrl}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<IEnumerable<DatabricksConnectionDto>>> GetConnectionsByTenantIdAsync(Guid tenantId)
        {
            // TODO: Implement creator-level permissions so owners can control access for other users.
            try
            {
                _logger.LogInformation("Attempting to retrieve connections for tenant ID: {TenantId}", tenantId);
                IEnumerable<DatabricksConnection> connections = await _repository.GetByTenantIdAsync(tenantId)
                    ?? Enumerable.Empty<DatabricksConnection>();
                List<DatabricksConnectionDto> connectionDtos = connections
                    .Select(connection => connection.ToDto())
                    .ToList();

                _logger.LogInformation(
                    "Successfully retrieved {ConnectionCount} connections for tenant ID: {TenantId}.",
                    connectionDtos.Count,
                    tenantId);
                return Result.Ok<IEnumerable<DatabricksConnectionDto>>(connectionDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve connections for tenant ID: {TenantId}", tenantId);
                return Result.Fail<IEnumerable<DatabricksConnectionDto>>(new ExceptionalError($"Failed to retrieve connections for tenant {tenantId}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<IEnumerable<DatabricksConnectionStatusDto>>> GetConnectionsWithAuthStatusAsync(Guid tenantId, Guid userId)
        {
            try
            {
                _logger.LogInformation("Retrieving connections with auth status for tenant {TenantId}, user {UserId}", tenantId, userId);

                IEnumerable<DatabricksConnection> connections = await _repository.GetByTenantIdAsync(tenantId)
                    ?? Enumerable.Empty<DatabricksConnection>();

                IEnumerable<DatabricksUserToken> userTokens = await _userTokenRepository.GetByUserAsync(userId);

                Dictionary<int, DatabricksUserToken> tokenByWorkspace = userTokens.ToDictionary(t => t.WorkspaceConnectionId);

                IEnumerable<DatabricksConnectionStatusDto> dtos = connections.Select(conn =>
                {
                    tokenByWorkspace.TryGetValue(conn.PkId, out DatabricksUserToken? token);

                    bool isAuthorized = token is not null
                        && !string.IsNullOrEmpty(token.RefreshToken)
                        && token.RevokedAt is null
                        && (token.RefreshTokenExpiresAt is null || token.RefreshTokenExpiresAt > DateTime.UtcNow);

                    return new DatabricksConnectionStatusDto
                    {
                        PkId = conn.PkId,
                        WorkspaceDisplayName = conn.WorkspaceDisplayName,
                        WorkspaceUrl = conn.WorkspaceUrl,
                        ClientId = conn.ClientId,
                        IsAuthorized = isAuthorized,
                        TokenExpiresAt = token?.RefreshTokenExpiresAt,
                    };
                });

                return Result.Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve auth status for tenant {TenantId}", tenantId);
                return Result.Fail<IEnumerable<DatabricksConnectionStatusDto>>(
                    new ExceptionalError($"Failed to retrieve connection auth status for tenant {tenantId}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<DatabricksConnectionDto>> CreateConnectionAsync(
            CreateDatabricksConnectionRequest request,
            Guid ownerId,
            Guid tenantId)
        {
            if (request == null)
            {
                return Result.Fail<DatabricksConnectionDto>(new BadRequestError("Request cannot be null."));
            }

            if (ownerId == Guid.Empty)
            {
                return Result.Fail<DatabricksConnectionDto>(new BadRequestError("OwnerId is required."));
            }

            if (tenantId == Guid.Empty)
            {
                return Result.Fail<DatabricksConnectionDto>(new BadRequestError("TenantId is required."));
            }

            if (string.IsNullOrWhiteSpace(request.WorkspaceDisplayName))
            {
                return Result.Fail<DatabricksConnectionDto>(new BadRequestError("WorkspaceDisplayName is required."));
            }

            Result<string> normalizedUrlResult = DatabricksWorkspaceUrlNormalizer.Normalize(request.WorkspaceUrl);
            if (normalizedUrlResult.IsFailed)
            {
                return Result.Fail<DatabricksConnectionDto>(normalizedUrlResult.Errors);
            }

            string normalizedWorkspaceUrl = normalizedUrlResult.Value;

            try
            {
                Result limitResult = await _tenantLimitService.EnsureCanAddWorkspaceConnectionAsync(tenantId);
                if (limitResult.IsFailed)
                {
                    return Result.Fail<DatabricksConnectionDto>(limitResult.Errors);
                }

                bool duplicateExists = await _repository.ExistsByTenantAndWorkspaceUrlAsync(
                    tenantId,
                    normalizedWorkspaceUrl);
                if (duplicateExists)
                {
                    return Result.Fail<DatabricksConnectionDto>(
                        new ConflictError("A workspace connection with this URL already exists for your tenant."));
                }

                DatabricksConnection connection = new DatabricksConnection
                {
                    TenantId = tenantId,
                    OwnerId = ownerId,
                    WorkspaceUrl = normalizedWorkspaceUrl,
                    WorkspaceDisplayName = request.WorkspaceDisplayName.Trim(),
                    ClientId = request.ClientId,
                    ClientSecret = request.ClientSecret,
                    AccessTokenTtlMinutes = request.AccessTokenTtlMinutes,
                    RefreshTokenLifespanMinutes = request.RefreshTokenLifespanMinutes,
                    CreatedOn = DateTime.UtcNow,
                    CreatedBy = ownerId,
                };

                _logger.LogInformation(
                    "Adding new connection for workspace {WorkspaceUrl} in tenant {TenantId}",
                    normalizedWorkspaceUrl,
                    tenantId);
                await _repository.AddAsync(connection);
                _logger.LogInformation(
                    "Successfully added connection {ConnectionId} for workspace {WorkspaceUrl}",
                    connection.PkId,
                    normalizedWorkspaceUrl);

                return Result.Ok(connection.ToDto());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create connection for workspace {WorkspaceUrl}", request.WorkspaceUrl);
                return Result.Fail<DatabricksConnectionDto>(
                    new ExceptionalError($"Failed to create connection for {request.WorkspaceUrl}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<DatabricksConnectionDto>> UpdateConnectionAsync(
            int connectionId,
            UpdateDatabricksConnectionRequest request,
            Guid tenantId)
        {
            if (request == null)
            {
                return Result.Fail<DatabricksConnectionDto>(new BadRequestError("Request cannot be null."));
            }

            if (connectionId <= 0)
            {
                return Result.Fail<DatabricksConnectionDto>(new BadRequestError("Connection ID must be positive."));
            }

            if (tenantId == Guid.Empty)
            {
                return Result.Fail<DatabricksConnectionDto>(new BadRequestError("TenantId is required."));
            }

            if (string.IsNullOrWhiteSpace(request.WorkspaceDisplayName))
            {
                return Result.Fail<DatabricksConnectionDto>(new BadRequestError("WorkspaceDisplayName is required."));
            }

            Result<string> normalizedUrlResult = DatabricksWorkspaceUrlNormalizer.Normalize(request.WorkspaceUrl);
            if (normalizedUrlResult.IsFailed)
            {
                return Result.Fail<DatabricksConnectionDto>(normalizedUrlResult.Errors);
            }

            string normalizedWorkspaceUrl = normalizedUrlResult.Value;

            try
            {
                DatabricksConnection? existing = await _repository.GetByIdForTenantAsync(connectionId, tenantId);
                if (existing == null)
                {
                    return Result.Fail<DatabricksConnectionDto>(
                        new NotFoundError($"Connection with ID {connectionId} was not found."));
                }

                bool duplicateExists = await _repository.ExistsByTenantAndWorkspaceUrlAsync(
                    tenantId,
                    normalizedWorkspaceUrl,
                    excludeConnectionId: connectionId);
                if (duplicateExists)
                {
                    return Result.Fail<DatabricksConnectionDto>(
                        new ConflictError("A workspace connection with this URL already exists for your tenant."));
                }

                _logger.LogInformation(
                    "Updating connection {ConnectionId} for workspace {WorkspaceUrl}",
                    connectionId,
                    normalizedWorkspaceUrl);

                existing.WorkspaceUrl = normalizedWorkspaceUrl;
                existing.WorkspaceDisplayName = request.WorkspaceDisplayName.Trim();
                if (!string.IsNullOrWhiteSpace(request.ClientId))
                {
                    existing.ClientId = request.ClientId;
                }

                if (!string.IsNullOrWhiteSpace(request.ClientSecret))
                {
                    existing.ClientSecret = request.ClientSecret;
                }

                existing.AccessTokenTtlMinutes =
                    request.AccessTokenTtlMinutes ?? existing.AccessTokenTtlMinutes;
                existing.RefreshTokenLifespanMinutes =
                    request.RefreshTokenLifespanMinutes ?? existing.RefreshTokenLifespanMinutes;
                existing.ModifiedOn = DateTime.UtcNow;

                await _repository.UpdateAsync(existing);
                _logger.LogInformation(
                    "Successfully updated connection {ConnectionId} for workspace {WorkspaceUrl}",
                    connectionId,
                    normalizedWorkspaceUrl);

                return Result.Ok(existing.ToDto());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update connection {ConnectionId}", connectionId);
                return Result.Fail<DatabricksConnectionDto>(
                    new ExceptionalError($"Failed to update connection ID {connectionId}.", ex));
            }
        }

        public async Task<Result> AddRefreshTokenAsync(Guid userId, int workspaceConnectionId, string refreshToken, DateTime? expiresAt, Guid tenantId)
        {
            if (userId == Guid.Empty || workspaceConnectionId <= 0 || string.IsNullOrEmpty(refreshToken))
            {
                return Result.Fail(new Error("UserId, WorkspaceConnectionId, and RefreshToken are required."));
            }

            try
            {
                Result<DatabricksConnection> connectionResult =
                    await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
                if (connectionResult.IsFailed)
                {
                    return Result.Fail(connectionResult.Errors);
                }

                var existingToken = await _userTokenRepository.GetByUserAndWorkspaceAsync(userId, workspaceConnectionId);
                bool isNewToken = IsNewRefreshToken(existingToken?.RefreshToken, refreshToken);

                _logger.LogInformation("Attempting to {Action} refresh token for user {UserId} and workspace connection {WorkspaceConnectionId}. Requested ExpiresAt: {ExpiresAt}", 
                    isNewToken ? "add/update" : "verify existing", userId, workspaceConnectionId, expiresAt?.ToString("o") ?? "null");
                
                var result = await _userTokenRepository.UpsertAsync(userId, workspaceConnectionId, refreshToken, expiresAt);
                
                if (isNewToken)
                {
                    _logger.LogInformation("Successfully saved new encrypted refresh token for user {UserId} and workspace connection {WorkspaceConnectionId}. Token will expire at: {ExpiresAt}", 
                        userId, workspaceConnectionId, expiresAt?.ToString("o") ?? "never");
                }
                else
                {
                    _logger.LogInformation("Refresh token unchanged for user {UserId} and workspace connection {WorkspaceConnectionId}. Keeping existing expiration: {ExpiresAt}", 
                        userId, workspaceConnectionId, result.RefreshTokenExpiresAt?.ToString("o") ?? "never");
                }
                
                return Result.Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to add/update refresh token for user {UserId} and workspace connection {WorkspaceConnectionId}", userId, workspaceConnectionId);
                return Result.Fail(new ExceptionalError($"Failed to add refresh token for user {userId} and workspace {workspaceConnectionId}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<string>> ExchangeTokenAsync(OAuthCodeExchangeRequest request, Guid tenantId)
        {
            if (request == null)
            {
                return Result.Fail<string>(new BadRequestError("Request body is null or invalid."));
            }

            if (tenantId == Guid.Empty)
            {
                return Result.Fail<string>(new BadRequestError("TenantId is required."));
            }

            Result<string> normalizedUrlResult = DatabricksWorkspaceUrlNormalizer.Normalize(request.WorkspaceUrl);
            if (normalizedUrlResult.IsFailed)
            {
                return Result.Fail<string>(normalizedUrlResult.Errors);
            }

            string normalizedWorkspaceUrl = normalizedUrlResult.Value;
            Result<DatabricksConnection> connectionResult = await GetConnectionOrFailAsync(normalizedWorkspaceUrl, tenantId);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<string>(connectionResult.Errors);
            }

            var connection = connectionResult.Value;
            var credentialsValidation = ValidateClientCredentials(connection, normalizedWorkspaceUrl);
            if (credentialsValidation.IsFailed)
            {
                return Result.Fail<string>(credentialsValidation.Errors);
            }

            try
            {
                var content = BuildTokenExchangeContent(connection, request);
                var response = await CreateDatabricksClient().PostAsync(BuildTokenEndpoint(normalizedWorkspaceUrl), content);
                var responseBody = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Token exchange response for workspace {WorkspaceUrl}: Status={Status}", normalizedWorkspaceUrl, response.StatusCode);
                if (!response.IsSuccessStatusCode)
                {
                    string oauthError = ExtractOAuthError(responseBody);
                    _logger.LogError("Token exchange failed. Status={Status}, Error={OAuthError}", response.StatusCode, oauthError);
                    return Result.Fail<string>(new Error($"Databricks token exchange failed with status {response.StatusCode}. {oauthError}"));
                }

                return Result.Ok(responseBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Token exchange failed for workspace: {WorkspaceUrl}", request.WorkspaceUrl);
                return Result.Fail<string>(new ExceptionalError("Network or internal error during token exchange.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<string>> RefreshAccessTokenAsync(Guid userId, int workspaceConnectionId, Guid tenantId)
        {
            return await RefreshAccessTokenCoreAsync(userId, workspaceConnectionId, tenantId, cacheAfterRefresh: true);
        }

        private async Task<Result<string>> RefreshAccessTokenCoreAsync(Guid userId, int workspaceConnectionId, Guid tenantId, bool cacheAfterRefresh)
        {
            if (userId == Guid.Empty || workspaceConnectionId <= 0)
            {
                return Result.Fail<string>(new Error("UserId and WorkspaceConnectionId must be positive."));
            }

            try
            {
                _logger.LogInformation("Refreshing Databricks access token for user {UserId} and workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                Result<DatabricksConnection> connectionResult =
                    await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
                if (connectionResult.IsFailed)
                {
                    return Result.Fail<string>(connectionResult.Errors);
                }

                DatabricksConnection connection = connectionResult.Value;
                var userToken = await _userTokenRepository.GetByUserAndWorkspaceAsync(userId, workspaceConnectionId);
                if (userToken == null || string.IsNullOrEmpty(userToken.RefreshToken))
                {
                    _logger.LogWarning("Refresh token not found for user {UserId} and workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                    return Result.Fail<string>(new Error($"Refresh token not found for user {userId} and workspace {workspaceConnectionId}"));
                }

                if (userToken.RevokedAt is not null)
                {
                    _logger.LogWarning("Refresh token for user {UserId} and workspace {WorkspaceConnectionId} has been revoked", userId, workspaceConnectionId);
                    return Result.Fail<string>(new UnauthorizedError("Workspace connection has been disconnected. Please re-authorize."));
                }

                var validationResult = ValidateClientCredentials(connection, connection.WorkspaceUrl);
                if (validationResult.IsFailed)
                {
                    return Result.Fail<string>(validationResult.Errors);
                }

                FormUrlEncodedContent content = BuildRefreshTokenContent(connection, userToken.RefreshToken);
                var response = await CreateDatabricksClient().PostAsync(BuildTokenEndpoint(connection.WorkspaceUrl), content);
                var responseBody = await response.Content.ReadAsStringAsync();
                _logger.LogDebug(
                    "Databricks refresh token API response for user {UserId}, workspace {WorkspaceConnectionId}: Status={Status}",
                    userId,
                    workspaceConnectionId,
                    response.StatusCode);

                if (!response.IsSuccessStatusCode)
                {
                    string oauthError = ExtractOAuthError(responseBody);
                    _logger.LogError("Token refresh failed for user {UserId}. Status={Status}, Error={OAuthError}", userId, response.StatusCode, oauthError);
                    bool isExpiredOrInvalidRefreshToken =
                        response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                        responseBody.Contains(DatabricksOAuthConstants.InvalidGrantError, StringComparison.OrdinalIgnoreCase) ||
                        responseBody.Contains(DatabricksOAuthConstants.ExpiredError, StringComparison.OrdinalIgnoreCase);

                    if (isExpiredOrInvalidRefreshToken)
                    {
                        return Result.Fail<string>(new UnauthorizedError("Databricks authentication expired. Please re-authenticate your Databricks workspace connection."));
                    }

                    return Result.Fail<string>(new Error($"Failed to refresh token. {ExtractOAuthError(responseBody)}"));
                }

                var tokenResult = ParseTokenResponse(responseBody);
                if (tokenResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Failed to parse Databricks refresh response for user {UserId}, workspace {WorkspaceConnectionId}. Errors={Errors}",
                        userId,
                        workspaceConnectionId,
                        string.Join("; ", tokenResult.Errors.Select(e => e.Message)));
                    return Result.Fail<string>(tokenResult.Errors);
                }

                var (accessToken, newRefreshToken) = tokenResult.Value;
                _logger.LogDebug(
                    "Parsed Databricks refresh response for user {UserId}, workspace {WorkspaceConnectionId}. AccessTokenLength={AccessTokenLength}, AccessTokenPreview={AccessTokenPreview}, RefreshTokenPresent={RefreshTokenPresent}",
                    userId,
                    workspaceConnectionId,
                    accessToken.Length,
                    MaskToken(accessToken),
                    !string.IsNullOrWhiteSpace(newRefreshToken));
                if (IsNewRefreshToken(userToken.RefreshToken, newRefreshToken))
                {
                    DateTime? newExpiration = null;
                    if (connection.RefreshTokenLifespanMinutes.HasValue)
                    {
                        newExpiration = DateTime.UtcNow.AddMinutes(connection.RefreshTokenLifespanMinutes.Value);
                    }
                    
                    await _userTokenRepository.RotateAsync(userId, workspaceConnectionId, newRefreshToken!, newExpiration);
                    _logger.LogInformation("Databricks returned new refresh token for user {UserId} and workspace {WorkspaceConnectionId}. Updated token, expiration: {ExpiresAt}, and LastRotatedAt.", 
                        userId, workspaceConnectionId, newExpiration?.ToString("o") ?? "never");
                }
                else
                {
                    _logger.LogDebug("Refresh token unchanged for user {UserId} and workspace {WorkspaceConnectionId}. No database update needed.", userId, workspaceConnectionId);
                }
                
                if (cacheAfterRefresh)
                {
                    await _accessTokenCache.SetAsync(userId, workspaceConnectionId, connection.AccessTokenTtlMinutes, accessToken);
                    _logger.LogDebug("Hydrated Databricks access token cache after refresh for user {UserId} and workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                }

                _logger.LogInformation("Successfully refreshed access token for user {UserId} and workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                return Result.Ok(accessToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing access token for user {UserId} and workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                return Result.Fail<string>(new ExceptionalError("Internal error during access token refresh.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<string>> GetValidAccessTokenAsync(Guid userId, int workspaceConnectionId, Guid tenantId)
        {
            if (userId == Guid.Empty || workspaceConnectionId <= 0)
            {
                return Result.Fail<string>(new Error("UserId and WorkspaceConnectionId must be positive."));
            }

            Result<DatabricksConnection> connectionResult =
                await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<string>(connectionResult.Errors);
            }

            DatabricksConnection connection = connectionResult.Value;
            var lockKey = $"{userId}:{workspaceConnectionId}";
            var gate = TokenLocks.GetOrAdd(lockKey, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();

            try
            {
                var cachedOrRefreshedToken = await _accessTokenCache.GetOrCreateAsync(
                    userId,
                    workspaceConnectionId,
                    connection.AccessTokenTtlMinutes,
                    async cancel =>
                    {
                        var refreshedTokenResult = await RefreshAccessTokenCoreAsync(userId, workspaceConnectionId, tenantId, cacheAfterRefresh: false);
                        if (refreshedTokenResult.IsFailed)
                        {
                            _logger.LogWarning(
                                "Refresh attempt from cache factory failed for user {UserId} and workspace {WorkspaceConnectionId}. Errors={Errors}",
                                userId,
                                workspaceConnectionId,
                                string.Join("; ", refreshedTokenResult.Errors.Select(e => e.Message)));
                        }

                        return refreshedTokenResult.IsSuccess ? refreshedTokenResult.ValueOrDefault : null;
                    });

                if (string.IsNullOrWhiteSpace(cachedOrRefreshedToken))
                {
                    _logger.LogWarning("Databricks access token unavailable after cache lookup for user {UserId} and workspace {WorkspaceConnectionId}; attempting direct refresh fallback", userId, workspaceConnectionId);

                    var fallbackRefreshResult = await RefreshAccessTokenCoreAsync(userId, workspaceConnectionId, tenantId, cacheAfterRefresh: true);
                    if (fallbackRefreshResult.IsSuccess)
                    {
                        return Result.Ok(fallbackRefreshResult.ValueOrDefault);
                    }

                    if (fallbackRefreshResult.Errors.Count > 0)
                    {
                        return Result.Fail<string>(fallbackRefreshResult.Errors);
                    }

                    return Result.Fail<string>(new Error($"Unable to get or refresh access token for user {userId} and workspace {workspaceConnectionId}."));
                }

                return Result.Ok(cachedOrRefreshedToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving access token for user {UserId} and workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                return Result.Fail<string>(new ExceptionalError("Failed to retrieve access token.", ex));
            }
            finally
            {
                gate.Release();
            }
        }

        public async Task<Result> DeleteConnectionAsync(int id, Guid tenantId, Guid userId, bool isTenantAdmin)
        {
            if (id <= 0)
            {
                return Result.Fail(new Error("Connection ID must be positive for deletion."));
            }

            try
            {
                _logger.LogInformation("Attempting to delete connection with ID: {ConnectionId}", id);
                DatabricksConnection? connection = await _repository.GetByIdAsync(id);
                if (connection == null)
                {
                    _logger.LogWarning("Connection with ID {ConnectionId} not found for deletion", id);
                    return Result.Fail(new NotFoundError($"Connection with ID {id} not found"));
                }

                Result tenantGuardResult =
                    _tenantResourceGuard.EnsureCanDeleteConnection(connection, tenantId, userId, isTenantAdmin);
                if (tenantGuardResult.IsFailed)
                {
                    return Result.Fail(tenantGuardResult.Errors);
                }

                await _repository.DeleteAsync(connection);
                _logger.LogInformation("Successfully deleted connection with ID: {ConnectionId}", id);
                return Result.Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete connection with ID: {ConnectionId}", id);
                return Result.Fail(new ExceptionalError($"Failed to delete connection ID {id}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result> DisconnectWorkspaceAsync(Guid userId, int workspaceConnectionId, Guid tenantId)
        {
            try
            {
                Result<DatabricksConnection> connectionResult =
                    await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
                if (connectionResult.IsFailed)
                {
                    return Result.Fail(connectionResult.Errors);
                }

                _logger.LogInformation("Disconnecting user {UserId} from workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                bool revoked = await _userTokenRepository.RevokeAsync(userId, workspaceConnectionId);
                if (!revoked)
                {
                    return Result.Fail(new NotFoundError($"No token found for user {userId} and workspace {workspaceConnectionId}."));
                }

                await _accessTokenCache.RemoveAsync(userId, workspaceConnectionId);
                _logger.LogInformation("Successfully disconnected user {UserId} from workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                return Result.Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to disconnect user {UserId} from workspace {WorkspaceConnectionId}", userId, workspaceConnectionId);
                return Result.Fail(new ExceptionalError($"Failed to disconnect workspace {workspaceConnectionId}.", ex));
            }
        }

        private async Task<Result<DatabricksConnection>> GetConnectionOrFailAsync(string workspaceUrl, Guid tenantId)
        {
            if (string.IsNullOrWhiteSpace(workspaceUrl))
            {
                return Result.Fail<DatabricksConnection>(new Error("Workspace URL cannot be empty."));
            }

            if (tenantId == Guid.Empty)
            {
                return Result.Fail<DatabricksConnection>(new BadRequestError("TenantId is required."));
            }

            DatabricksConnection? connection = await _repository.GetByTenantAndWorkspaceUrlAsync(tenantId, workspaceUrl);
            if (connection == null)
            {
                _logger.LogWarning(
                    "Connection not found for workspace {WorkspaceUrl} in tenant {TenantId}",
                    workspaceUrl,
                    tenantId);
                return Result.Fail<DatabricksConnection>(
                    new Error($"Connection configuration not found for workspace: {workspaceUrl}"));
            }

            return Result.Ok(connection);
        }

        private static Result ValidateClientCredentials(DatabricksConnection connection, string workspaceUrl)
        {
            if (string.IsNullOrWhiteSpace(connection.ClientId) || string.IsNullOrWhiteSpace(connection.ClientSecret))
            {
                return Result.Fail(new Error($"Client ID or Client Secret is missing for connection: {workspaceUrl}"));
            }

            return Result.Ok();
        }

        /// <summary>
        /// Determines if a new refresh token is different from the existing one.
        /// </summary>
        /// <param name="existingToken">The existing refresh token (null if none exists).</param>
        /// <param name="newToken">The new refresh token to compare (null if none provided).</param>
        /// <returns>True if the new token is different and should be saved; false otherwise.</returns>
        private static bool IsNewRefreshToken(string? existingToken, string? newToken)
        {
            if (string.IsNullOrEmpty(existingToken))
            {
                return !string.IsNullOrEmpty(newToken);
            }

            if (string.IsNullOrEmpty(newToken))
            {
                return false;
            }
            return existingToken != newToken;
        }



        private static FormUrlEncodedContent BuildTokenExchangeContent(DatabricksConnection connection, OAuthCodeExchangeRequest request)
        {
            var body = new Dictionary<string, string>
            {
                { DatabricksOAuthConstants.ClientIdField, connection.ClientId! },
                { DatabricksOAuthConstants.ClientSecretField, connection.ClientSecret! },
                { DatabricksOAuthConstants.GrantTypeField, DatabricksOAuthConstants.AuthorizationCodeGrantType },
                { DatabricksOAuthConstants.RedirectUriField, request.RedirectUri },
                { DatabricksOAuthConstants.CodeVerifierField, request.CodeVerifier },
                { DatabricksOAuthConstants.CodeField, request.Code },
                { DatabricksOAuthConstants.ScopeField, DatabricksOAuthConstants.AllApisOfflineAccessScope }
            };

            return new FormUrlEncodedContent(body);
        }

        private static FormUrlEncodedContent BuildRefreshTokenContent(DatabricksConnection connection, string refreshToken)
        {
            var body = new Dictionary<string, string>
            {
                { DatabricksOAuthConstants.ClientIdField, connection.ClientId! },
                { DatabricksOAuthConstants.ClientSecretField, connection.ClientSecret! },
                { DatabricksOAuthConstants.GrantTypeField, DatabricksOAuthConstants.RefreshTokenGrantType },
                { DatabricksOAuthConstants.RefreshTokenField, refreshToken },
                { DatabricksOAuthConstants.ScopeField, DatabricksOAuthConstants.AllApisOfflineAccessScope }
            };

            return new FormUrlEncodedContent(body);
        }

        private static Result<(string AccessToken, string? RefreshToken)> ParseTokenResponse(string responseBody)
        {
            try
            {
                using var doc = JsonDocument.Parse(responseBody);
                if (!doc.RootElement.TryGetProperty(DatabricksOAuthConstants.AccessTokenProperty, out var accessTokenElement) || accessTokenElement.GetString() == null)
                {
                    return Result.Fail<(string, string?)>(new Error($"Token refresh succeeded but {DatabricksOAuthConstants.AccessTokenProperty} was missing in response body."));
                }

                var accessToken = accessTokenElement.GetString()!;
                
                string? refreshToken = null;
                if (doc.RootElement.TryGetProperty(DatabricksOAuthConstants.RefreshTokenField, out var refreshTokenElement))
                {
                    refreshToken = refreshTokenElement.GetString();
                }

                return Result.Ok((accessToken, refreshToken));
            }
            catch (JsonException ex)
            {
                return Result.Fail<(string, string?)>(new ExceptionalError("Failed to parse token refresh response.", ex));
            }
        }



        private HttpClient CreateDatabricksClient()
        {
            return _httpClientFactory.CreateClient(DatabricksConfiguration.HttpClientName);
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

        private static string BuildTokenEndpoint(string workspaceUrl)
        {
            return $"{workspaceUrl.TrimEnd('/')}{DatabricksApiRoutes.OidcTokenPath}";
        }

        /// <summary>
        /// Extracts only the OAuth error code and description from a token endpoint response.
        /// Never logs or returns raw tokens or full response bodies.
        /// </summary>
        private static string ExtractOAuthError(string responseBody)
        {
            try
            {
                using JsonDocument doc = JsonDocument.Parse(responseBody);
                string? error = doc.RootElement.TryGetProperty("error", out JsonElement e) ? e.GetString() : null;
                string? desc = doc.RootElement.TryGetProperty("error_description", out JsonElement d) ? d.GetString() : null;
                if (error != null)
                {
                    return desc != null ? $"{error}: {desc}" : error;
                }
            }
            catch (JsonException) { }
            return "Unknown error (could not parse response)";
        }
    }
}