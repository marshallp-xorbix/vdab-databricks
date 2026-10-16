using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksJobService : IDatabricksJobService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly IDatabricksWorkspaceConnectionResolver _workspaceResolver;
    private readonly ILogger<DatabricksJobService> _logger;

    public DatabricksJobService(
        IDatabricksApiService databricksApi,
        IDatabricksWorkspaceConnectionResolver workspaceResolver,
        ILogger<DatabricksJobService> logger)
    {
        _databricksApi = databricksApi;
        _workspaceResolver = workspaceResolver;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<List<DatabricksJob>>> GetJobsAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<DatabricksJob>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Databricks jobs for workspace: {workspaceUrl}", workspaceUrl);

            return await GetJobsFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Databricks jobs for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<DatabricksJob>>("Failed to retrieve Databricks jobs");
        }
    }

    private async Task<Result<List<DatabricksJob>>> GetJobsFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl)
    {
        try
        {
            string apiUrl = DatabricksApiRoutes.JobsListPath;
            _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

            Result<DatabricksJobsResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksJobsResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<DatabricksJob>>(apiResponseResult.Errors);
            }

            DatabricksJobsResponse? apiResponse = apiResponseResult.ValueOrDefault;
            if (apiResponse?.Jobs == null)
            {
                _logger.LogWarning("No jobs found in Databricks workspace. API response was empty.");
                return Result.Ok(new List<DatabricksJob>());
            }

            List<DatabricksJob> jobs = apiResponse.Jobs.Select(j => new DatabricksJob
            {
                JobId = j.JobId?.ToString() ?? "",
                JobName = j.Settings?.Name ?? "Unnamed Job",
                CreatorUserName = j.CreatorUserName,
                JobType = j.Settings?.JobType
            }).Where(j => !string.IsNullOrEmpty(j.JobId)).ToList();

            _logger.LogInformation("Retrieved {count} Databricks jobs", jobs.Count);
            return Result.Ok(jobs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks Jobs API");
            return Result.Fail<List<DatabricksJob>>("Failed to communicate with Databricks API");
        }
    }

    private sealed class DatabricksJobsResponse
    {
        [JsonPropertyName("jobs")]
        public List<DatabricksJobInfo>? Jobs { get; set; }
    }

    private sealed class DatabricksJobInfo
    {
        [JsonPropertyName("job_id")]
        public long? JobId { get; set; }

        [JsonPropertyName("creator_user_name")]
        public string? CreatorUserName { get; set; }

        [JsonPropertyName("settings")]
        public DatabricksJobSettings? Settings { get; set; }
    }

    private sealed class DatabricksJobSettings
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("job_type")]
        public string? JobType { get; set; }
    }
}
