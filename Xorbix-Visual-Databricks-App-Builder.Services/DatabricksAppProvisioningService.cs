using System.Text.Json;
using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public sealed class DatabricksAppProvisioningService : IDatabricksAppProvisioningService
{
    private static readonly JsonSerializerOptions SnakeCaseOptions = new JsonSerializerOptions()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly IDatabricksApiService _databricksApi;
    private readonly ILogger<DatabricksAppProvisioningService> _logger;

    public DatabricksAppProvisioningService(
        IDatabricksApiService databricksApi,
        ILogger<DatabricksAppProvisioningService> logger)
    {
        _databricksApi = databricksApi;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<CreatedDatabricksAppDto>> CreateDatabricksAppAsync(
        Guid userId,
        string workspaceUrl,
        int workspaceConnectionId,
        string name,
        string? description,
        List<DatabricksAppResource>? resources,
        string userSafeUpstreamMessage)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Fail<CreatedDatabricksAppDto>(new BadRequestError("Name is required."));
        }

        string trimmedName = name.Trim();
        CreateDatabricksAppApiRequest apiBody = new CreateDatabricksAppApiRequest
        {
            Name = trimmedName,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Resources = resources is { Count: > 0 } ? resources : null
        };

        Result<DatabricksAppResponse> createResult = await _databricksApi.PostAsync<DatabricksAppResponse>(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            DatabricksApiRoutes.AppsCreatePath,
            apiBody,
            SnakeCaseOptions);
        if (createResult.IsFailed)
        {
            _logger.LogError(
                "Databricks create app failed. WorkspaceConnectionId={WorkspaceConnectionId}, DatabricksAppName={DatabricksAppName}, Errors={Errors}",
                workspaceConnectionId,
                trimmedName,
                string.Join("; ", createResult.Errors.Select(e => e.Message)));
            return Result.Fail<CreatedDatabricksAppDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
        }

        DatabricksAppResponse? created = createResult.ValueOrDefault;
        if (created == null || string.IsNullOrWhiteSpace(created.Name))
        {
            _logger.LogError(
                "Databricks create app returned an invalid response. WorkspaceConnectionId={WorkspaceConnectionId}, DatabricksAppName={DatabricksAppName}",
                workspaceConnectionId,
                trimmedName);
            return Result.Fail<CreatedDatabricksAppDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
        }

        return Result.Ok(new CreatedDatabricksAppDto
        {
            Name = created.Name.Trim(),
            UpdateTime = string.IsNullOrWhiteSpace(created.UpdateTime) ? null : created.UpdateTime,
            Url = string.IsNullOrWhiteSpace(created.Url) ? null : created.Url
        });
    }
}
