using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksGenieSpaceService : IDatabricksGenieSpaceService
{
    private const int PageSize = 200;
    private const int MaxPages = 50;

    private readonly IDatabricksApiService _databricksApi;
    private readonly IDatabricksWorkspaceConnectionResolver _workspaceResolver;
    private readonly ILogger<DatabricksGenieSpaceService> _logger;

    public DatabricksGenieSpaceService(
        IDatabricksApiService databricksApi,
        IDatabricksWorkspaceConnectionResolver workspaceResolver,
        ILogger<DatabricksGenieSpaceService> logger)
    {
        _databricksApi = databricksApi;
        _workspaceResolver = workspaceResolver;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<List<DatabricksGenieSpaceListItem>>> GetGenieSpacesAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<DatabricksGenieSpaceListItem>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            Dictionary<string, DatabricksGenieSpaceListItem> byId = new(StringComparer.OrdinalIgnoreCase);
            string? pageToken = null;

            for (int pageIndex = 0; pageIndex < MaxPages; pageIndex++)
            {
                Result<string> rawResult;
                if (pageIndex == 0)
                {
                    string path = DatabricksApiRoutes.GenieSpacesListPagePath(PageSize, pageToken);
                    rawResult = await _databricksApi.GetStringAsync(userId, workspaceConnectionId, workspaceUrl, path);
                    if (rawResult.IsFailed &&
                        DatabricksDataConnectorApiRouteHelpers.ErrorsIndicateMissingHttpRoute(rawResult.Errors))
                    {
                        _logger.LogInformation(
                            "Genie ListSpaces GET route unavailable for connection {WorkspaceConnectionId}; trying POST list.",
                            workspaceConnectionId);
                        Result<JsonElement> postResult = await _databricksApi.PostAsync<JsonElement>(
                            userId,
                            workspaceConnectionId,
                            workspaceUrl,
                            DatabricksApiRoutes.GenieSpacesListPath,
                            new { });
                        if (postResult.IsFailed)
                        {
                            return Result.Fail<List<DatabricksGenieSpaceListItem>>(postResult.Errors);
                        }

                        rawResult = Result.Ok(postResult.Value.GetRawText());
                    }
                }
                else
                {
                    string path = DatabricksApiRoutes.GenieSpacesListPagePath(PageSize, pageToken);
                    rawResult = await _databricksApi.GetStringAsync(userId, workspaceConnectionId, workspaceUrl, path);
                }

                if (rawResult.IsFailed)
                {
                    return Result.Fail<List<DatabricksGenieSpaceListItem>>(rawResult.Errors);
                }

                string content = rawResult.Value;
                if (!GenieSpacesListResponseParser.TryParse(content, out GenieSpacesListParsedPage? parsed) || parsed == null)
                {
                    return Result.Fail<List<DatabricksGenieSpaceListItem>>(
                        new Error("Failed to parse Databricks Genie spaces response."));
                }

                foreach (GenieSpaceApiRow s in parsed.Spaces)
                {
                    string? id = s.SpaceId ?? s.Id;
                    if (string.IsNullOrWhiteSpace(id))
                    {
                        continue;
                    }

                    string name = s.Title ?? s.Name ?? id.Trim();
                    byId[id.Trim()] = new DatabricksGenieSpaceListItem { SpaceId = id.Trim(), Name = name.Trim() };
                }

                if (string.IsNullOrEmpty(parsed.NextPageToken))
                {
                    break;
                }

                pageToken = parsed.NextPageToken;
            }

            List<DatabricksGenieSpaceListItem> items = byId.Values
                .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (items.Count == 0)
            {
                _logger.LogInformation(
                    "Databricks returned no Genie spaces for connection {WorkspaceConnectionId} after paging.",
                    workspaceConnectionId);
            }

            return Result.Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing Genie spaces for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<DatabricksGenieSpaceListItem>>("Failed to retrieve Genie spaces");
        }
    }
}
