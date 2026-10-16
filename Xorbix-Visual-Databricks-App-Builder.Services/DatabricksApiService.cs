using System.Net.Http.Headers;
using System.Net;
using System.Text;
using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public class DatabricksApiService : IDatabricksApiService
{
    private static readonly JsonSerializerOptions DefaultJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDatabricksConnectionRepository _connectionRepository;
    private readonly IDatabricksConnectionService _connectionService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<DatabricksApiService> _logger;

    public DatabricksApiService(
        IHttpClientFactory httpClientFactory,
        IDatabricksConnectionRepository connectionRepository,
        IDatabricksConnectionService connectionService,
        ICurrentUserService currentUserService,
        ILogger<DatabricksApiService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _connectionRepository = connectionRepository;
        _connectionService = connectionService;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    /// <inheritdoc/>
    public Task<Result<T>> GetAsync<T>(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpoint,
        JsonSerializerOptions? options = null)
    {
        HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, BuildRequestUri(workspaceUrl, endpoint));
        return SendAsync<T>(userId, workspaceConnectionId, workspaceUrl, request, options);
    }

    /// <inheritdoc/>
    public async Task<Result<DatabricksAppResponse?>> GetDatabricksAppByNameAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string appName,
        JsonSerializerOptions? options = null)
    {
        string endpoint = DatabricksApiRoutes.AppByNamePath(appName);
        HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, BuildRequestUri(workspaceUrl, endpoint));
        Result<(HttpResponseMessage Response, string Content)> sendResult =
            await SendAuthenticatedAsync(userId, workspaceConnectionId, workspaceUrl, request);
        if (sendResult.IsFailed)
        {
            return Result.Fail<DatabricksAppResponse?>(sendResult.Errors);
        }

        HttpResponseMessage response = sendResult.Value.Response;
        string content = sendResult.Value.Content;
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return Result.Ok<DatabricksAppResponse?>(null);
        }

        if (!response.IsSuccessStatusCode)
        {
            return Result.Fail<DatabricksAppResponse?>(
                new BadRequestError(BuildHttpFailureMessage(response, content)));
        }

        Result<DatabricksAppResponse> deserialized =
            DeserializeJson<DatabricksAppResponse>(content, options ?? DefaultJsonOptions);
        if (deserialized.IsFailed)
        {
            return Result.Fail<DatabricksAppResponse?>(deserialized.Errors);
        }

        return Result.Ok<DatabricksAppResponse?>(deserialized.Value);
    }

    /// <inheritdoc/>
    public Task<Result<T>> PatchAsync<T>(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpoint,
        object body,
        JsonSerializerOptions? options = null)
    {
        JsonSerializerOptions serializerOptions = options ?? DefaultJsonOptions;
        HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Patch, BuildRequestUri(workspaceUrl, endpoint))
        {
            Content = CreateJsonContent(body, serializerOptions)
        };

        return SendAsync<T>(userId, workspaceConnectionId, workspaceUrl, request, options);
    }

    /// <inheritdoc/>
    public Task<Result<T>> PostAsync<T>(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpoint,
        object? body = null,
        JsonSerializerOptions? options = null)
    {
        HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, BuildRequestUri(workspaceUrl, endpoint))
        {
            Content = CreateJsonContent(body, options ?? DefaultJsonOptions)
        };

        return SendAsync<T>(userId, workspaceConnectionId, workspaceUrl, request, options);
    }

    /// <inheritdoc/>
    public async Task<Result> DeleteAsync(Guid userId, int workspaceConnectionId, string workspaceUrl, string endpoint)
    {
        HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Delete, BuildRequestUri(workspaceUrl, endpoint));
        Result<(HttpResponseMessage Response, string Content)> sendResult =
            await SendAuthenticatedAsync(userId, workspaceConnectionId, workspaceUrl, request);
        if (sendResult.IsFailed)
        {
            return Result.Fail(sendResult.Errors);
        }

        HttpResponseMessage response = sendResult.Value.Response;
        string content = sendResult.Value.Content;
        if (!response.IsSuccessStatusCode)
        {
            return Result.Fail(new BadRequestError(BuildHttpFailureMessage(response, content)));
        }

        return Result.Ok();
    }

    /// <inheritdoc/>
    public async Task<Result<T>> SendAsync<T>(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        HttpRequestMessage request,
        JsonSerializerOptions? options = null)
    {
        Result<(HttpResponseMessage Response, string Content)> sendResult =
            await SendAuthenticatedAsync(userId, workspaceConnectionId, workspaceUrl, request);
        if (sendResult.IsFailed)
        {
            return Result.Fail<T>(sendResult.Errors);
        }

        HttpResponseMessage response = sendResult.Value.Response;
        string content = sendResult.Value.Content;
        if (!response.IsSuccessStatusCode)
        {
            return Result.Fail<T>(new BadRequestError(BuildHttpFailureMessage(response, content)));
        }

        return DeserializeJson<T>(content, options ?? DefaultJsonOptions);
    }

    /// <inheritdoc/>
    public async Task<Result<string>> GetStringAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpoint)
    {
        HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, BuildRequestUri(workspaceUrl, endpoint));
        Result<(HttpResponseMessage Response, string Content)> sendResult =
            await SendAuthenticatedAsync(userId, workspaceConnectionId, workspaceUrl, request);
        if (sendResult.IsFailed)
        {
            return Result.Fail<string>(sendResult.Errors);
        }

        HttpResponseMessage response = sendResult.Value.Response;
        string content = sendResult.Value.Content;
        if (!response.IsSuccessStatusCode)
        {
            return Result.Fail<string>(new BadRequestError(BuildHttpFailureMessage(response, content)));
        }

        return Result.Ok(content);
    }

    private async Task<Result<(HttpResponseMessage Response, string Content)>> SendAuthenticatedAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        HttpRequestMessage request)
    {
        if (userId == Guid.Empty)
        {
            return Result.Fail<(HttpResponseMessage, string)>(new Error("User ID is required."));
        }

        if (workspaceConnectionId <= 0)
        {
            return Result.Fail<(HttpResponseMessage, string)>(new Error("WorkspaceConnectionId must be greater than 0."));
        }

        if (string.IsNullOrWhiteSpace(workspaceUrl))
        {
            return Result.Fail<(HttpResponseMessage, string)>(new Error("Workspace URL is required."));
        }

        if (request.RequestUri == null)
        {
            return Result.Fail<(HttpResponseMessage, string)>(new Error("Request URI is required."));
        }

        Guid? currentUserId = _currentUserService.GetUserId();
        if (!currentUserId.HasValue)
        {
            return Result.Fail<(HttpResponseMessage, string)>(
                new UnauthorizedError("Authenticated user context is required."));
        }

        if (currentUserId.Value != userId)
        {
            _logger.LogWarning(
                "User mismatch on Databricks API call. Requested={RequestedUserId}, Current={CurrentUserId}",
                userId,
                currentUserId.Value);
            return Result.Fail<(HttpResponseMessage, string)>(
                new ForbiddenError("User context does not match the authenticated user."));
        }

        Guid? currentTenantId = _currentUserService.GetTenantId();
        if (!currentTenantId.HasValue)
        {
            return Result.Fail<(HttpResponseMessage, string)>(
                new UnauthorizedError("Tenant context is required."));
        }

        Result<Uri> uriResult = EnsureRequestUri(workspaceUrl, request.RequestUri);
        if (uriResult.IsFailed)
        {
            return Result.Fail<(HttpResponseMessage, string)>(uriResult.Errors);
        }

        request.RequestUri = uriResult.Value;

        DatabricksConnection? connection = await _connectionRepository.GetByIdAsync(workspaceConnectionId);
        if (connection == null)
        {
            return Result.Fail<(HttpResponseMessage, string)>(
                new Error($"Workspace connection not found for ID: {workspaceConnectionId}"));
        }

        if (!WorkspaceUrlsMatch(connection.WorkspaceUrl, workspaceUrl))
        {
            _logger.LogWarning(
                "Workspace URL mismatch for connection {WorkspaceConnectionId}. Expected={ExpectedUrl}, Actual={ActualUrl}",
                workspaceConnectionId,
                connection.WorkspaceUrl,
                workspaceUrl);
            return Result.Fail<(HttpResponseMessage, string)>(
                new Error("Workspace URL does not match the selected workspace connection."));
        }

        if (!connection.TenantId.HasValue)
        {
            return Result.Fail<(HttpResponseMessage, string)>(
                new Error($"Workspace connection tenant is missing for ID: {workspaceConnectionId}"));
        }

        if (connection.TenantId.Value != currentTenantId.Value)
        {
            _logger.LogWarning(
                "Workspace connection tenant mismatch for connection {WorkspaceConnectionId}. ConnectionTenant={ConnectionTenantId}, CurrentTenant={CurrentTenantId}",
                workspaceConnectionId,
                connection.TenantId.Value,
                currentTenantId.Value);
            return Result.Fail<(HttpResponseMessage, string)>(
                new ForbiddenError("Workspace connection does not belong to the authenticated tenant."));
        }

        Result<string> tokenResult = await _connectionService.GetValidAccessTokenAsync(
            userId,
            workspaceConnectionId,
            currentTenantId.Value);
        if (tokenResult.IsFailed)
        {
            return Result.Fail<(HttpResponseMessage, string)>(tokenResult.Errors);
        }

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenResult.ValueOrDefault);

        HttpClient client = _httpClientFactory.CreateClient(DatabricksConfiguration.HttpClientName);

        try
        {
            HttpResponseMessage response = await client.SendAsync(request);
            string content = await response.Content.ReadAsStringAsync();
            return Result.Ok((response, content));
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogError(ex, "Databricks request timed out: {Endpoint}", request.RequestUri);
            return Result.Fail<(HttpResponseMessage, string)>(new ExceptionalError("Databricks request timed out.", ex));
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Databricks request failed: {Endpoint}", request.RequestUri);
            return Result.Fail<(HttpResponseMessage, string)>(new ExceptionalError("Databricks request failed.", ex));
        }
    }

    private static bool WorkspaceUrlsMatch(string? configuredUrl, string? requestedUrl)
    {
        if (string.IsNullOrWhiteSpace(configuredUrl) || string.IsNullOrWhiteSpace(requestedUrl))
        {
            return false;
        }

        return string.Equals(
            configuredUrl.Trim().TrimEnd('/'),
            requestedUrl.Trim().TrimEnd('/'),
            StringComparison.OrdinalIgnoreCase);
    }

    private static Result<T> DeserializeJson<T>(string content, JsonSerializerOptions options)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            if (typeof(T) == typeof(JsonElement))
            {
                JsonSerializerOptions effectiveOptions = options ?? DefaultJsonOptions;
                JsonElement emptyObject = JsonSerializer.Deserialize<JsonElement>("{}", effectiveOptions);
                return Result.Ok((T)(object)emptyObject);
            }

            return Result.Fail<T>(new Error("Databricks response was empty."));
        }

        try
        {
            T? result = JsonSerializer.Deserialize<T>(content, options);
            if (result == null)
            {
                return Result.Fail<T>(new Error("Databricks response could not be parsed."));
            }

            return Result.Ok(result);
        }
        catch (JsonException ex)
        {
            return Result.Fail<T>(new ExceptionalError("Failed to parse Databricks response.", ex));
        }
    }

    private static StringContent CreateJsonContent(object? body, JsonSerializerOptions options)
    {
        string payload = body == null ? "{}" : JsonSerializer.Serialize(body, options);
        return new StringContent(payload, Encoding.UTF8, "application/json");
    }

    private static Uri BuildRequestUri(string workspaceUrl, string endpoint)
    {
        if (Uri.TryCreate(endpoint, UriKind.Absolute, out Uri? absoluteUri))
        {
            return absoluteUri;
        }

        string baseUri = workspaceUrl.TrimEnd('/') + "/";
        string relative = endpoint.TrimStart('/');
        return new Uri(new Uri(baseUri, UriKind.Absolute), relative);
    }

    private static Result<Uri> EnsureRequestUri(string workspaceUrl, Uri requestUri)
    {
        if (requestUri.IsAbsoluteUri)
        {
            return Result.Ok(requestUri);
        }

        if (string.IsNullOrWhiteSpace(workspaceUrl))
        {
            return Result.Fail<Uri>(new Error("Workspace URL is required to build request URI."));
        }

        string baseUri = workspaceUrl.TrimEnd('/') + "/";
        Uri uri = new Uri(new Uri(baseUri, UriKind.Absolute), requestUri);
        return Result.Ok(uri);
    }

    private static string BuildHttpFailureMessage(HttpResponseMessage response, string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return $"Databricks API returned {response.StatusCode}.";
        }

        return $"Databricks API returned {response.StatusCode}. Details: {content}";
    }
}
