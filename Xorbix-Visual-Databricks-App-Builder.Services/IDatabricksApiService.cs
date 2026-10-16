using System.Text.Json;
using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Centralized Databricks API gateway for authenticated HTTP calls and JSON handling.
/// </summary>
public interface IDatabricksApiService
{
    /// <summary>
    /// Sends an authenticated GET request and deserializes the JSON response into <typeparamref name="T"/>.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">The tenant-scoped workspace connection ID used for OAuth token lookup.</param>
    /// <param name="workspaceUrl">Databricks workspace base URL.</param>
    /// <param name="endpoint">Relative API endpoint or absolute URL.</param>
    /// <param name="options">Optional JSON serializer options override.</param>
    /// <returns>A result containing the deserialized response.</returns>
    Task<Result<T>> GetAsync<T>(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpoint,
        JsonSerializerOptions? options = null);

    /// <summary>
    /// Sends an authenticated PATCH request with a JSON body and deserializes the JSON response into <typeparamref name="T"/>.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">The tenant-scoped workspace connection ID used for OAuth token lookup.</param>
    /// <param name="workspaceUrl">Databricks workspace base URL.</param>
    /// <param name="endpoint">Relative API endpoint or absolute URL.</param>
    /// <param name="body">Request body object.</param>
    /// <param name="options">Optional JSON serializer options override.</param>
    /// <returns>A result containing the deserialized response.</returns>
    Task<Result<T>> PatchAsync<T>(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpoint,
        object body,
        JsonSerializerOptions? options = null);

    /// <summary>
    /// Sends an authenticated POST request with a JSON body and deserializes the JSON response into <typeparamref name="T"/>.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">The tenant-scoped workspace connection ID used for OAuth token lookup.</param>
    /// <param name="workspaceUrl">Databricks workspace base URL.</param>
    /// <param name="endpoint">Relative API endpoint or absolute URL.</param>
    /// <param name="body">Request body object. Uses an empty JSON object when null.</param>
    /// <param name="options">Optional JSON serializer options override.</param>
    /// <returns>A result containing the deserialized response.</returns>
    Task<Result<T>> PostAsync<T>(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpoint,
        object? body = null,
        JsonSerializerOptions? options = null);

    /// <summary>
    /// Sends an authenticated DELETE request.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">The tenant-scoped workspace connection ID used for OAuth token lookup.</param>
    /// <param name="workspaceUrl">Databricks workspace base URL.</param>
    /// <param name="endpoint">Relative API endpoint or absolute URL.</param>
    /// <returns>A result indicating success or failure.</returns>
    Task<Result> DeleteAsync(Guid userId, int workspaceConnectionId, string workspaceUrl, string endpoint);

    /// <summary>
    /// Sends a fully constructed HTTP request (used for multipart or streaming scenarios) and deserializes JSON.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">The tenant-scoped workspace connection ID used for OAuth token lookup.</param>
    /// <param name="workspaceUrl">Databricks workspace base URL.</param>
    /// <param name="request">Pre-built request message; request URI can be relative.</param>
    /// <param name="options">Optional JSON serializer options override.</param>
    /// <returns>A result containing the deserialized response.</returns>
    Task<Result<T>> SendAsync<T>(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        HttpRequestMessage request,
        JsonSerializerOptions? options = null);

    /// <summary>
    /// Sends an authenticated GET to Databricks app-by-name endpoint and returns null when the app is not found (404).
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">The tenant-scoped workspace connection ID used for OAuth token lookup.</param>
    /// <param name="workspaceUrl">Databricks workspace base URL.</param>
    /// <param name="appName">Databricks app name.</param>
    /// <param name="options">Optional JSON serializer options override.</param>
    /// <returns>A result containing the Databricks app response or null if the app does not exist.</returns>
    Task<Result<DatabricksAppResponse?>> GetDatabricksAppByNameAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string appName,
        JsonSerializerOptions? options = null);

    /// <summary>
    /// Sends an authenticated GET request and returns the raw response content.
    /// </summary>
    /// <param name="userId">The ID of the requesting user.</param>
    /// <param name="workspaceConnectionId">The tenant-scoped workspace connection ID used for OAuth token lookup.</param>
    /// <param name="workspaceUrl">Databricks workspace base URL.</param>
    /// <param name="endpoint">Relative API endpoint or absolute URL.</param>
    /// <returns>A result containing the raw response content.</returns>
    Task<Result<string>> GetStringAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpoint);
}
