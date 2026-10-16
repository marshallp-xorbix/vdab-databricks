using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksExperimentService : IDatabricksExperimentService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly IDatabricksWorkspaceConnectionResolver _workspaceResolver;
    private readonly ILogger<DatabricksExperimentService> _logger;

    public DatabricksExperimentService(
        IDatabricksApiService databricksApi,
        IDatabricksWorkspaceConnectionResolver workspaceResolver,
        ILogger<DatabricksExperimentService> logger)
    {
        _databricksApi = databricksApi;
        _workspaceResolver = workspaceResolver;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<List<DatabricksExperimentListItem>>> GetExperimentsAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<DatabricksExperimentListItem>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            Dictionary<string, object> body = new() { ["max_results"] = 500 };
            Result<MlflowExperimentsListResponse> apiResponseResult =
                await _databricksApi.PostAsync<MlflowExperimentsListResponse>(
                    userId,
                    workspaceConnectionId,
                    workspaceUrl,
                    DatabricksApiRoutes.MlflowExperimentsSearchPath,
                    body);
            if (apiResponseResult.IsFailed && DatabricksDataConnectorApiRouteHelpers.ErrorsIndicateMissingHttpRoute(apiResponseResult.Errors))
            {
                _logger.LogInformation(
                    "MLflow experiments/search unavailable for connection {WorkspaceConnectionId}; trying experiments/list.",
                    workspaceConnectionId);
                apiResponseResult =
                    await _databricksApi.PostAsync<MlflowExperimentsListResponse>(
                        userId,
                        workspaceConnectionId,
                        workspaceUrl,
                        DatabricksApiRoutes.MlflowExperimentsListPath,
                        body);
            }

            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<DatabricksExperimentListItem>>(apiResponseResult.Errors);
            }

            MlflowExperimentsListResponse? apiResponse = apiResponseResult.ValueOrDefault;
            List<DatabricksExperimentListItem> list = (apiResponse?.Experiments ?? [])
                .Where(e => !string.IsNullOrWhiteSpace(e.ExperimentId))
                .Select(e => new DatabricksExperimentListItem
                {
                    ExperimentId = e.ExperimentId!.Trim(),
                    Name = string.IsNullOrWhiteSpace(e.Name) ? e.ExperimentId!.Trim() : e.Name!.Trim()
                })
                .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Result.Ok(list);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing MLflow experiments for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<DatabricksExperimentListItem>>("Failed to retrieve experiments");
        }
    }

    private sealed class MlflowExperimentsListResponse
    {
        [JsonPropertyName("experiments")]
        public List<MlflowExperimentApiItem>? Experiments { get; set; }
    }

    private sealed class MlflowExperimentApiItem
    {
        [JsonPropertyName("experiment_id")]
        public string? ExperimentId { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
}
