using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksSqlWarehouseService : IDatabricksSqlWarehouseService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly IDatabricksWorkspaceConnectionResolver _workspaceResolver;
    private readonly ILogger<DatabricksSqlWarehouseService> _logger;

    public DatabricksSqlWarehouseService(
        IDatabricksApiService databricksApi,
        IDatabricksWorkspaceConnectionResolver workspaceResolver,
        ILogger<DatabricksSqlWarehouseService> logger)
    {
        _databricksApi = databricksApi;
        _workspaceResolver = workspaceResolver;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<List<DatabricksSqlWarehouse>>> GetSqlWarehousesAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<DatabricksSqlWarehouse>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting SQL warehouses for workspace: {workspaceUrl}", workspaceUrl);

            return await GetSqlWarehousesFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting SQL warehouses for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<DatabricksSqlWarehouse>>("Failed to retrieve SQL warehouses");
        }
    }

    private async Task<Result<List<DatabricksSqlWarehouse>>> GetSqlWarehousesFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl)
    {
        try
        {
            List<DatabricksSqlWarehouse> warehouses = new();
            string? nextPageToken = null;

            do
            {
                string apiUrl = DatabricksApiRoutes.SqlWarehousesPath;
                if (!string.IsNullOrWhiteSpace(nextPageToken))
                {
                    apiUrl = $"{apiUrl}&page_token={Uri.EscapeDataString(nextPageToken)}";
                }

                _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

                Result<DatabricksWarehousesListResponse> apiResponseResult =
                    await _databricksApi.GetAsync<DatabricksWarehousesListResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
                if (apiResponseResult.IsFailed)
                {
                    return Result.Fail<List<DatabricksSqlWarehouse>>(apiResponseResult.Errors);
                }

                DatabricksWarehousesListResponse? apiResponse = apiResponseResult.ValueOrDefault;
                if (apiResponse?.Warehouses != null)
                {
                    foreach (DatabricksWarehouseInfo w in apiResponse.Warehouses)
                    {
                        if (string.IsNullOrWhiteSpace(w.Id))
                        {
                            continue;
                        }

                        warehouses.Add(new DatabricksSqlWarehouse
                        {
                            WarehouseId = w.Id.Trim(),
                            Name = string.IsNullOrWhiteSpace(w.Name) ? w.Id.Trim() : w.Name.Trim()
                        });
                    }
                }

                nextPageToken = apiResponse?.NextPageToken;
            }
            while (!string.IsNullOrWhiteSpace(nextPageToken));

            _logger.LogInformation("Retrieved {count} SQL warehouses", warehouses.Count);
            return Result.Ok(warehouses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks SQL warehouses API");
            return Result.Fail<List<DatabricksSqlWarehouse>>("Failed to communicate with Databricks API");
        }
    }

    private sealed class DatabricksWarehousesListResponse
    {
        [JsonPropertyName("warehouses")]
        public List<DatabricksWarehouseInfo>? Warehouses { get; set; }

        [JsonPropertyName("next_page_token")]
        public string? NextPageToken { get; set; }
    }

    private sealed class DatabricksWarehouseInfo
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
}
