using System.Text.Json;
using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksSecretService : IDatabricksSecretService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly IDatabricksWorkspaceConnectionResolver _workspaceResolver;
    private readonly ILogger<DatabricksSecretService> _logger;

    public DatabricksSecretService(
        IDatabricksApiService databricksApi,
        IDatabricksWorkspaceConnectionResolver workspaceResolver,
        ILogger<DatabricksSecretService> logger)
    {
        _databricksApi = databricksApi;
        _workspaceResolver = workspaceResolver;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<List<string>>> GetSecretScopesAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<string>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            Result<DatabricksSecretScopesListResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksSecretScopesListResponse>(userId, workspaceConnectionId, workspaceUrl, DatabricksApiRoutes.SecretsScopesListPath);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<string>>(apiResponseResult.Errors);
            }

            List<string> scopes = (apiResponseResult.ValueOrDefault?.Scopes ?? [])
                .Select(s => s.Name)
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => n!.Trim())
                .Distinct(StringComparer.Ordinal)
                .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Result.Ok(scopes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing secret scopes for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<string>>("Failed to retrieve secret scopes");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<string>>> GetSecretKeysAsync(Guid userId, int workspaceConnectionId, string scope)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<string>>();
            }

            if (string.IsNullOrWhiteSpace(scope))
            {
                return Result.Fail<List<string>>("Secret scope is required");
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            string trimmedScope = scope.Trim();
            return await ListSecretKeysFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, trimmedScope);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing secret keys for connection: {workspaceConnectionId}, scope: {scope}", workspaceConnectionId, scope);
            return Result.Fail<List<string>>("Failed to retrieve secret keys");
        }
    }

    private async Task<Result<List<string>>> ListSecretKeysFromDatabricksAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string trimmedScope)
    {
        DatabricksSecretsListRequest requestBody = new() { Scope = trimmedScope };
        Result<JsonElement> postResult =
            await _databricksApi.PostAsync<JsonElement>(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                    DatabricksApiRoutes.SecretsListPath,
                requestBody);
        if (postResult.IsSuccess)
        {
            return ParseDatabricksSecretKeyNamesFromListResponse(postResult.Value);
        }

        if (DatabricksDataConnectorApiRouteHelpers.ErrorsIndicateMissingHttpRoute(postResult.Errors))
        {
            string encodedScope = Uri.EscapeDataString(trimmedScope);
            Result<JsonElement> getResult =
                await _databricksApi.GetAsync<JsonElement>(
                    userId,
                    workspaceConnectionId,
                    workspaceUrl,
                    DatabricksApiRoutes.SecretsListByScopePath(encodedScope));
            if (getResult.IsSuccess)
            {
                return ParseDatabricksSecretKeyNamesFromListResponse(getResult.Value);
            }

            _logger.LogWarning(
                "Databricks secrets list GET also failed for scope {Scope}. POST: {PostErrors}; GET: {GetErrors}",
                trimmedScope,
                string.Join("; ", postResult.Errors.Select(static e => e.Message)),
                string.Join("; ", getResult.Errors.Select(static e => e.Message)));
            return Result.Fail<List<string>>(getResult.Errors);
        }

        return Result.Fail<List<string>>(postResult.Errors);
    }

    private static Result<List<string>> ParseDatabricksSecretKeyNamesFromListResponse(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            return Result.Fail<List<string>>("Unexpected Databricks secrets list response shape.");
        }

        List<string> keys = new();
        AddSecretKeysFromArrayProperty(root, "secrets", keys);
        AddSecretKeysFromArrayProperty(root, "secret_metadata", keys);

        List<string> ordered = keys
            .Where(static k => !string.IsNullOrWhiteSpace(k))
            .Select(static k => k.Trim())
            .Distinct(StringComparer.Ordinal)
            .OrderBy(static k => k, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Result.Ok(ordered);
    }

    private static void AddSecretKeysFromArrayProperty(JsonElement root, string propertyName, List<string> keys)
    {
        if (!root.TryGetProperty(propertyName, out JsonElement array) || array.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (JsonElement item in array.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (!item.TryGetProperty("key", out JsonElement keyEl))
            {
                continue;
            }

            if (keyEl.ValueKind == JsonValueKind.String)
            {
                string? k = keyEl.GetString();
                if (!string.IsNullOrWhiteSpace(k))
                {
                    keys.Add(k);
                }
            }
        }
    }

    private sealed class DatabricksSecretsListRequest
    {
        [JsonPropertyName("scope")]
        public string Scope { get; set; } = string.Empty;
    }

    private sealed class DatabricksSecretScopesListResponse
    {
        [JsonPropertyName("scopes")]
        public List<DatabricksSecretScopeRow>? Scopes { get; set; }
    }

    private sealed class DatabricksSecretScopeRow
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
}
