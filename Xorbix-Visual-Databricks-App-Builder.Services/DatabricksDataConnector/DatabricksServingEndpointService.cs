using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksServingEndpointService : IDatabricksServingEndpointService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly IDatabricksWorkspaceConnectionResolver _workspaceResolver;
    private readonly ILogger<DatabricksServingEndpointService> _logger;

    public DatabricksServingEndpointService(
        IDatabricksApiService databricksApi,
        IDatabricksWorkspaceConnectionResolver workspaceResolver,
        ILogger<DatabricksServingEndpointService> logger)
    {
        _databricksApi = databricksApi;
        _workspaceResolver = workspaceResolver;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<List<DatabricksServingEndpointListItem>>> GetServingEndpointsAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<DatabricksServingEndpointListItem>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            Result<DatabricksServingEndpointsListResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksServingEndpointsListResponse>(userId, workspaceConnectionId, workspaceUrl, DatabricksApiRoutes.ServingEndpointsPath);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<DatabricksServingEndpointListItem>>(apiResponseResult.Errors);
            }

            DatabricksServingEndpointsListResponse? apiResponse = apiResponseResult.ValueOrDefault;
            List<DatabricksServingEndpointListItem> list = [];
            foreach (DatabricksServingEndpointApiItem? e in apiResponse?.Endpoints ?? [])
            {
                if (e == null)
                {
                    continue;
                }

                string? n = e.Name ?? e.Config?.Name;
                if (string.IsNullOrWhiteSpace(n))
                {
                    continue;
                }

                list.Add(new DatabricksServingEndpointListItem { Name = n.Trim() });
            }

            list = list.DistinctBy(x => x.Name, StringComparer.Ordinal).OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase).ToList();
            return Result.Ok(list);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing serving endpoints for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<DatabricksServingEndpointListItem>>("Failed to retrieve serving endpoints");
        }
    }

    private sealed class DatabricksServingEndpointsListResponse
    {
        [JsonPropertyName("endpoints")]
        public List<DatabricksServingEndpointApiItem>? Endpoints { get; set; }
    }

    private sealed class DatabricksServingEndpointApiItem
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("config")]
        public DatabricksServingConfigInner? Config { get; set; }
    }

    private sealed class DatabricksServingConfigInner
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
}
