using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public class AppActionService : IAppActionService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly ILogger<AppActionService> _logger;
    private readonly IAppService _appService;
    private readonly IDatabricksWorkspaceConnectionValidator _workspaceConnectionValidator;
    private readonly IDatabricksAppProvisioningService _databricksAppProvisioningService;

    private static readonly JsonSerializerOptions SnakeCaseOptions = new JsonSerializerOptions()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public AppActionService(
        IDatabricksApiService databricksApi,
        ILogger<AppActionService> logger,
        IAppService appService,
        IDatabricksWorkspaceConnectionValidator workspaceConnectionValidator,
        IDatabricksAppProvisioningService databricksAppProvisioningService)
    {
        _databricksApi = databricksApi;
        _logger = logger;
        _appService = appService;
        _workspaceConnectionValidator = workspaceConnectionValidator;
        _databricksAppProvisioningService = databricksAppProvisioningService;
    }

    /// <inheritdoc/>
    public Task<Result<AppStatusResponse>> GetAppStatusAsync(Guid userId, Guid tenantId, int appId)
    {
        return ExecuteAppActionAsync(userId, tenantId, appId, string.Empty, HttpMethod.Get);
    }

    /// <inheritdoc/>
    public async Task<Result<DatabricksAppResponse>> GetAppDetailsAsync(Guid userId, Guid tenantId, int appId)
    {
        const string userSafeUpstreamMessage =
            "Unable to load app details from Databricks. Please try again later.";

        try
        {
            Result<AppDatabricksContext> contextResult = await GetAppContextAsync(appId, tenantId);
            if (contextResult.IsFailed)
            {
                LogAppDetailsOutcome(
                    appId,
                    null,
                    null,
                    "Failed",
                    null,
                    "ContextInvalid");
                return contextResult.ToResult<DatabricksAppResponse>();
            }

            AppDatabricksContext context = contextResult.Value;
            string endpoint = DatabricksApiRoutes.AppByNamePath(context.AppName);

            Result<JsonElement> jsonResult = await _databricksApi.GetAsync<JsonElement>(
                userId,
                context.WorkspaceConnectionId,
                context.WorkspaceUrl,
                endpoint,
                SnakeCaseOptions);

            if (jsonResult.IsFailed)
            {
                _logger.LogError(
                    "Databricks app details upstream failure. AppId={AppId}, WorkspaceConnectionId={WorkspaceConnectionId}, DatabricksAppName={DatabricksAppName}, Endpoint={Endpoint}, Errors={Errors}",
                    appId,
                    context.WorkspaceConnectionId,
                    context.AppName,
                    endpoint,
                    string.Join("; ", jsonResult.Errors.Select(e => e.Message)));

                LogAppDetailsOutcome(
                    appId,
                    context.WorkspaceConnectionId,
                    context.AppName,
                    "Failed",
                    null,
                    "DatabricksUpstream");

                return Result.Fail<DatabricksAppResponse>(new UpstreamDependencyError(userSafeUpstreamMessage));
            }

            JsonElement root = jsonResult.Value;
            DatabricksAppResponse? legacy = JsonSerializer.Deserialize<DatabricksAppResponse>(root.GetRawText(), SnakeCaseOptions);
            if (legacy == null)
            {
                _logger.LogError(
                    "Databricks app details parse returned null. AppId={AppId}, WorkspaceConnectionId={WorkspaceConnectionId}",
                    appId,
                    context.WorkspaceConnectionId);

                LogAppDetailsOutcome(
                    appId,
                    context.WorkspaceConnectionId,
                    context.AppName,
                    "Failed",
                    null,
                    "ParseError");

                return Result.Fail<DatabricksAppResponse>(new UpstreamDependencyError(userSafeUpstreamMessage));
            }

            AppSettingsDetailsDto appSettings = AppSettingsDetailsMapper.MapFromRoot(root, SnakeCaseOptions);
            legacy.AppSettings = appSettings;

            int warningCount = appSettings.Warnings.Count;
            LogAppDetailsOutcome(
                appId,
                context.WorkspaceConnectionId,
                context.AppName,
                "Success",
                warningCount,
                null);

            if (warningCount > 0)
            {
                _logger.LogWarning(
                    "App details mapping produced warnings. AppId={AppId}, WorkspaceConnectionId={WorkspaceConnectionId}, DatabricksAppName={DatabricksAppName}, WarningCount={WarningCount}",
                    appId,
                    context.WorkspaceConnectionId,
                    context.AppName,
                    warningCount);
            }

            return Result.Ok(legacy);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error getting app details for AppId={AppId}", appId);
            LogAppDetailsOutcome(appId, null, null, "Failed", null, "Unexpected");
            return Result.Fail<DatabricksAppResponse>(new UpstreamDependencyError(userSafeUpstreamMessage));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UpdateAppResourcesResponseDto>> UpdateAppResourcesAsync(
        Guid userId,
        Guid tenantId,
        int appId,
        UpdateAppResourcesRequestDto request)
    {
        const string userSafeUpstreamMessage =
            "Unable to update app resources in Databricks. Please try again later.";

        if (request == null)
        {
            return Result.Fail<UpdateAppResourcesResponseDto>(new ValidationError("Request body is required."));
        }

        if (string.IsNullOrWhiteSpace(request.ExpectedUpdateTime))
        {
            return Result.Fail<UpdateAppResourcesResponseDto>(
                new ValidationError("ExpectedUpdateTime is required for optimistic concurrency."));
        }

        List<NormalizedAppResourceDto> resourceList = request.Resources ?? new List<NormalizedAppResourceDto>();
        Result<List<DatabricksAppResource>> buildResult = AppResourcesPayloadBuilder.BuildAndValidate(resourceList);
        if (buildResult.IsFailed)
        {
            return Result.Fail<UpdateAppResourcesResponseDto>(buildResult.Errors);
        }

        try
        {
            Result<AppDatabricksContext> contextResult = await GetAppContextAsync(appId, tenantId);
            if (contextResult.IsFailed)
            {
                return contextResult.ToResult<UpdateAppResourcesResponseDto>();
            }

            AppDatabricksContext context = contextResult.Value;
            string workspaceUrl = context.WorkspaceUrl;
            string appName = context.AppName;
            string endpoint = DatabricksApiRoutes.AppByNamePath(appName);

            Result<JsonElement> getResult = await _databricksApi.GetAsync<JsonElement>(
                userId,
                context.WorkspaceConnectionId,
                workspaceUrl,
                endpoint,
                SnakeCaseOptions);

            if (getResult.IsFailed)
            {
                _logger.LogError(
                    "Databricks GET app before resources update failed. AppId={AppId}, Errors={Errors}",
                    appId,
                    string.Join("; ", getResult.Errors.Select(e => e.Message)));
                return Result.Fail<UpdateAppResourcesResponseDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
            }

            DatabricksAppResponse? currentApp = JsonSerializer.Deserialize<DatabricksAppResponse>(
                getResult.Value.GetRawText(),
                SnakeCaseOptions);
            if (currentApp == null)
            {
                return Result.Fail<UpdateAppResourcesResponseDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
            }

            string expectedTrimmed = request.ExpectedUpdateTime.Trim();
            string actualTrimmed = (currentApp.UpdateTime ?? string.Empty).Trim();
            if (!string.Equals(expectedTrimmed, actualTrimmed, StringComparison.Ordinal))
            {
                return Result.Fail<UpdateAppResourcesResponseDto>(
                    new ConflictError(
                        "The Databricks app was modified elsewhere. Reload app details and try again."));
            }

            object patchBody = new { resources = buildResult.Value };
            Result<JsonElement> patchResult = await _databricksApi.PatchAsync<JsonElement>(
                userId,
                context.WorkspaceConnectionId,
                workspaceUrl,
                endpoint,
                patchBody,
                SnakeCaseOptions);

            if (patchResult.IsFailed)
            {
                _logger.LogError(
                    "Databricks PATCH app resources failed. AppId={AppId}, Errors={Errors}",
                    appId,
                    string.Join("; ", patchResult.Errors.Select(e => e.Message)));
                string userMessage = BuildUserVisibleDatabricksPatchFailureMessage(patchResult.Errors);
                return Result.Fail<UpdateAppResourcesResponseDto>(new BadRequestError(userMessage));
            }

            Result<JsonElement> refreshedResult = await _databricksApi.GetAsync<JsonElement>(
                userId,
                context.WorkspaceConnectionId,
                workspaceUrl,
                endpoint,
                SnakeCaseOptions);

            if (refreshedResult.IsFailed)
            {
                _logger.LogWarning(
                    "Databricks GET app after resources update failed; returning PATCH response. AppId={AppId}",
                    appId);
                JsonElement refreshedRoot = patchResult.Value;
                return MapUpdateResourcesResponse(refreshedRoot);
            }

            return MapUpdateResourcesResponse(refreshedResult.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error updating app resources for AppId={AppId}", appId);
            return Result.Fail<UpdateAppResourcesResponseDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
        }
    }

    /// <summary>
    /// Builds a concise message for the API client from Databricks API failure text
    /// (typically <c>Databricks API returned ... Details: {json}</c>).
    /// </summary>
    private static string BuildUserVisibleDatabricksPatchFailureMessage(IEnumerable<IError> errors)
    {
        string raw = string.Join(" ", errors.Select(e => e.Message));
        string? parsed = TryParseDatabricksDetailsMessage(raw);
        if (!string.IsNullOrWhiteSpace(parsed))
        {
            return parsed!;
        }

        return string.IsNullOrWhiteSpace(raw) ? "Unable to update app resources in Databricks." : raw.Trim();
    }

    private static string? TryParseDatabricksDetailsMessage(string raw)
    {
        const string marker = "Details: ";
        int idx = raw.IndexOf(marker, StringComparison.Ordinal);
        if (idx < 0)
        {
            return null;
        }

        string json = raw[(idx + marker.Length)..].Trim();
        try
        {
            using JsonDocument doc = JsonDocument.Parse(json);
            JsonElement root = doc.RootElement;
            if (!root.TryGetProperty("message", out JsonElement messageEl))
            {
                return null;
            }

            string? message = messageEl.GetString();
            if (string.IsNullOrWhiteSpace(message))
            {
                return null;
            }

            if (root.TryGetProperty("error_code", out JsonElement codeEl))
            {
                string? code = codeEl.GetString();
                if (!string.IsNullOrWhiteSpace(code))
                {
                    return $"{message.Trim()} ({code.Trim()})";
                }
            }

            return message.Trim();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private Result<UpdateAppResourcesResponseDto> MapUpdateResourcesResponse(JsonElement root)
    {
        DatabricksAppResponse? legacy = JsonSerializer.Deserialize<DatabricksAppResponse>(root.GetRawText(), SnakeCaseOptions);
        if (legacy == null)
        {
            return Result.Fail<UpdateAppResourcesResponseDto>(
                new UpstreamDependencyError("Unable to read app details from Databricks after update."));
        }

        AppSettingsDetailsDto appSettings = AppSettingsDetailsMapper.MapFromRoot(root, SnakeCaseOptions);
        legacy.AppSettings = appSettings;

        UpdateAppResourcesResponseDto dto = new UpdateAppResourcesResponseDto
        {
            UpdateTime = legacy.UpdateTime ?? string.Empty,
            AppSettings = appSettings
        };

        return Result.Ok(dto);
    }

    private void LogAppDetailsOutcome(
        int appId,
        int? workspaceConnectionId,
        string? databricksAppName,
        string outcome,
        int? warningCount,
        string? failureReasonCode)
    {
        _logger.LogInformation(
            "App details request completed. AppId={AppId}, WorkspaceConnectionId={WorkspaceConnectionId}, DatabricksAppName={DatabricksAppName}, Outcome={Outcome}, WarningCount={WarningCount}, FailureReasonCode={FailureReasonCode}",
            appId,
            workspaceConnectionId,
            databricksAppName,
            outcome,
            warningCount,
            failureReasonCode);
    }

    /// <inheritdoc/>
    public Task<Result<AppStatusResponse>> StartAppAsync(Guid userId, Guid tenantId, int appId)
    {
        return ExecuteAppActionAsync(userId, tenantId, appId, AppActionApiRoutes.Start, HttpMethod.Post);
    }

    /// <inheritdoc/>
    public Task<Result<AppStatusResponse>> StopAppAsync(Guid userId, Guid tenantId, int appId)
    {
        return ExecuteAppActionAsync(userId, tenantId, appId, AppActionApiRoutes.Stop, HttpMethod.Post);
    }

    /// <inheritdoc/>
    public async Task<Result<DatabricksAppNamesResponseDto>> ListDatabricksAppNamesAsync(
        Guid userId,
        Guid tenantId,
        int appId,
        int workspaceConnectionId)
    {
        const string userSafeUpstreamMessage =
            "Unable to load Databricks apps for this workspace. Please try double-checking your Databricks workspace connection and try again.";

        if (appId <= 0 || workspaceConnectionId <= 0)
        {
            return Result.Fail<DatabricksAppNamesResponseDto>(
                new BadRequestError("AppId and workspaceConnectionId must be greater than 0."));
        }

        try
        {
            Result<AppDto?> appResult = await _appService.GetAppByIdAsync(appId, tenantId);
            if (appResult.IsFailed)
            {
                return appResult.ToResult<DatabricksAppNamesResponseDto>();
            }

            AppDto? appDto = appResult.ValueOrDefault;
            if (appDto == null)
            {
                return Result.Fail<DatabricksAppNamesResponseDto>(new NotFoundError("App not found."));
            }

            Result<DatabricksConnection> connectionResult =
                await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<DatabricksAppNamesResponseDto>(connectionResult.Errors);
            }

            DatabricksConnection connection = connectionResult.Value;
            return await FetchAndSortAllDatabricksAppNamesAsync(userId, connection.WorkspaceUrl, workspaceConnectionId, appId, userSafeUpstreamMessage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error listing Databricks apps for AppId={AppId}", appId);
            return Result.Fail<DatabricksAppNamesResponseDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<DatabricksAppNamesResponseDto>> ListDatabricksAppNamesForWorkspaceAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId)
    {
        const string userSafeUpstreamMessage =
            "Unable to load Databricks apps for this workspace. Please try double-checking your Databricks workspace connection and try again.";

        if (workspaceConnectionId <= 0)
        {
            return Result.Fail<DatabricksAppNamesResponseDto>(
                new BadRequestError("workspaceConnectionId must be greater than 0."));
        }

        try
        {
            Result<DatabricksConnection> connectionResult =
                await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<DatabricksAppNamesResponseDto>(connectionResult.Errors);
            }

            DatabricksConnection connection = connectionResult.Value;
            return await FetchAndSortAllDatabricksAppNamesAsync(userId, connection.WorkspaceUrl, workspaceConnectionId, appIdForLogging: null, userSafeUpstreamMessage);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Unexpected error listing Databricks apps for WorkspaceConnectionId={WorkspaceConnectionId}",
                workspaceConnectionId);
            return Result.Fail<DatabricksAppNamesResponseDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<CreatedDatabricksAppDto>> CreateDatabricksAppAsync(
        Guid userId,
        Guid tenantId,
        CreateDatabricksAppRequestDto request)
    {
        const string userSafeUpstreamMessage =
            "Unable to create the Databricks app for this workspace. Please verify your workspace connection and try again.";

        if (request.WorkspaceConnectionId <= 0)
        {
            return Result.Fail<CreatedDatabricksAppDto>(
                new BadRequestError("workspaceConnectionId must be greater than 0."));
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result.Fail<CreatedDatabricksAppDto>(new BadRequestError("Name is required."));
        }

        try
        {
            Result<DatabricksConnection> connectionResult =
                await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, request.WorkspaceConnectionId);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<CreatedDatabricksAppDto>(connectionResult.Errors);
            }

            DatabricksConnection connection = connectionResult.Value;
            Result<CreatedDatabricksAppDto> createResult = await _databricksAppProvisioningService.CreateDatabricksAppAsync(
                userId,
                connection.WorkspaceUrl,
                request.WorkspaceConnectionId,
                request.Name,
                request.Description,
                request.Resources,
                userSafeUpstreamMessage);
            if (createResult.IsFailed)
            {
                return Result.Fail<CreatedDatabricksAppDto>(createResult.Errors);
            }

            return Result.Ok(createResult.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Unexpected error creating Databricks app. WorkspaceConnectionId={WorkspaceConnectionId}",
                request.WorkspaceConnectionId);
            return Result.Fail<CreatedDatabricksAppDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
        }
    }

    private async Task<Result<DatabricksAppNamesResponseDto>> FetchAndSortAllDatabricksAppNamesAsync(
        Guid userId,
        string workspaceUrl,
        int workspaceConnectionId,
        int? appIdForLogging,
        string userSafeUpstreamMessage)
    {
        List<string> names = new List<string>();
        string? nextPageToken = null;
        int pageCount = 0;
        const int pageSize = 100;
        const int maxPages = 10000;

        do
        {
            if (++pageCount > maxPages)
            {
                _logger.LogError(
                    "Databricks apps list exceeded max pages. AppId={AppId}, WorkspaceConnectionId={WorkspaceConnectionId}",
                    appIdForLogging,
                    workspaceConnectionId);
                return Result.Fail<DatabricksAppNamesResponseDto>(
                    new UpstreamDependencyError(userSafeUpstreamMessage));
            }

            string endpoint = DatabricksApiRoutes.AppsListPath(pageSize);
            if (!string.IsNullOrWhiteSpace(nextPageToken))
            {
                endpoint += $"&page_token={Uri.EscapeDataString(nextPageToken)}";
            }

            Result<DatabricksAppsListPage> pageResult = await _databricksApi.GetAsync<DatabricksAppsListPage>(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                endpoint,
                SnakeCaseOptions);

            if (pageResult.IsFailed)
            {
                _logger.LogError(
                    "Databricks apps list failed. AppId={AppId}, WorkspaceConnectionId={WorkspaceConnectionId}, Errors={Errors}",
                    appIdForLogging,
                    workspaceConnectionId,
                    string.Join("; ", pageResult.Errors.Select(e => e.Message)));

                return Result.Fail<DatabricksAppNamesResponseDto>(
                    new UpstreamDependencyError(userSafeUpstreamMessage));
            }

            DatabricksAppsListPage? page = pageResult.ValueOrDefault;
            if (page?.Apps != null)
            {
                foreach (DatabricksAppListItem item in page.Apps)
                {
                    if (!string.IsNullOrWhiteSpace(item.Name))
                    {
                        names.Add(item.Name.Trim());
                    }
                }
            }

            nextPageToken = page?.NextPageToken;
        }
        while (!string.IsNullOrWhiteSpace(nextPageToken));

        names.Sort(StringComparer.OrdinalIgnoreCase);

        return Result.Ok(new DatabricksAppNamesResponseDto
        {
            AppNames = names
        });
    }

    private async Task<Result<AppStatusResponse>> ExecuteAppActionAsync(
        Guid userId,
        Guid tenantId,
        int appId,
        string action,
        HttpMethod method)
    {
        try
        {
            Result<AppDatabricksContext> contextResult = await GetAppContextAsync(appId, tenantId);
            if (contextResult.IsFailed)
            {
                return contextResult.ToResult<AppStatusResponse>();
            }

            AppDatabricksContext context = contextResult.Value;
            string workspaceUrl = context.WorkspaceUrl;
            string appName = context.AppName;
            string endpoint = BuildDatabricksAppApiUrl(appName, action);

            HttpRequestMessage request = new HttpRequestMessage(method, endpoint);
            if (method != HttpMethod.Get)
            {
                request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            }

            Result<JsonElement> response = await _databricksApi.SendAsync<JsonElement>(
                userId,
                context.WorkspaceConnectionId,
                workspaceUrl,
                request);
            if (response.IsFailed)
            {
                _logger.LogError(
                    "Databricks app action failed. Action={Action}, AppId={AppId}, Errors={Errors}",
                    string.IsNullOrWhiteSpace(action) ? AppActionApiRoutes.Status : action,
                    appId,
                    string.Join(", ", response.Errors.Select(e => e.Message)));

                return Result.Fail<AppStatusResponse>(response.Errors);
            }

            string responseContent = response.ValueOrDefault.GetRawText();
            return ParseStatusResponse(responseContent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error performing app action for AppId={AppId}", appId);
            return Result.Fail<AppStatusResponse>(new ExceptionalError("App action failed.", ex));
        }
    }

    private async Task<Result<AppDatabricksContext>> GetAppContextAsync(int appId, Guid tenantId)
    {
        if (appId <= 0)
        {
            return Result.Fail<AppDatabricksContext>(new BadRequestError("AppId must be greater than 0."));
        }

        Result<AppDto?> appResult = await _appService.GetAppByIdAsync(appId, tenantId);
        if (appResult.IsFailed || appResult.ValueOrDefault == null)
        {
            return Result.Fail<AppDatabricksContext>(new NotFoundError("App not found."));
        }

        string? databricksAppName = appResult.ValueOrDefault.DatabricksAppName;
        if (string.IsNullOrWhiteSpace(databricksAppName))
        {
            return Result.Fail<AppDatabricksContext>(
                new BadRequestError("Databricks app name is not configured."));
        }

        int workspaceConnectionId = appResult.ValueOrDefault.WorkspaceConnectionId;
        if (workspaceConnectionId <= 0)
        {
            return Result.Fail<AppDatabricksContext>(
                new BadRequestError("App does not have a workspace connection configured."));
        }

        Result<DatabricksConnection> connectionResult =
            await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
        if (connectionResult.IsFailed)
        {
            return Result.Fail<AppDatabricksContext>(connectionResult.Errors);
        }

        DatabricksConnection connection = connectionResult.Value;

        if (string.IsNullOrWhiteSpace(connection.WorkspaceUrl))
        {
            return Result.Fail<AppDatabricksContext>(new BadRequestError("Workspace URL is missing."));
        }

        return Result.Ok(new AppDatabricksContext(connection.WorkspaceUrl, databricksAppName, workspaceConnectionId));
    }

    private sealed record AppDatabricksContext(string WorkspaceUrl, string AppName, int WorkspaceConnectionId);

    private static string BuildDatabricksAppApiUrl(string appName, string action)
    {
        string apiPath = string.IsNullOrWhiteSpace(action)
            ? DatabricksApiRoutes.AppByNamePath(appName)
            : DatabricksApiRoutes.AppByNameAndActionPath(appName, action);

        return apiPath;
    }

    private static Result<AppStatusResponse> ParseStatusResponse(string responseContent)
    {
        if (string.IsNullOrWhiteSpace(responseContent))
        {
            return Result.Fail<AppStatusResponse>(new BadRequestError("Empty response from Databricks."));
        }

        DatabricksAppStatusResponse? databricksResponse = JsonSerializer.Deserialize<DatabricksAppStatusResponse>(responseContent, SnakeCaseOptions);
        DatabricksComputeStatus? computeStatus = databricksResponse?.AppStatus?.ComputeStatus;
        string state = computeStatus?.State ?? string.Empty;
        string message = computeStatus?.Message ?? string.Empty;

        if (string.IsNullOrWhiteSpace(state))
        {
            AppStatusResponse fallback = ExtractComputeStatusFromJson(responseContent);
            state = fallback.State;
            message = string.IsNullOrWhiteSpace(message) ? fallback.Message : message;
        }

        return Result.Ok(new AppStatusResponse
        {
            State = state,
            Message = message
        });
    }

    private static AppStatusResponse ExtractComputeStatusFromJson(string responseContent)
    {
        try
        {
            using JsonDocument document = JsonDocument.Parse(responseContent);
            if (document.RootElement.TryGetProperty("app_status", out JsonElement appStatusElement))
            {
                if (appStatusElement.TryGetProperty("compute_status", out JsonElement computeStatusElement))
                {
                    return ReadStatusFromElement(computeStatusElement);
                }
            }

            if (document.RootElement.TryGetProperty("compute_status", out JsonElement rootComputeStatusElement))
            {
                return ReadStatusFromElement(rootComputeStatusElement);
            }
        }
        catch
        {
            // Ignore parsing errors and fall back to empty status.
        }

        return new AppStatusResponse();
    }

    private static AppStatusResponse ReadStatusFromElement(JsonElement statusElement)
    {
        string state = statusElement.TryGetProperty("state", out JsonElement stateElement)
            ? stateElement.GetString() ?? string.Empty
            : string.Empty;

        string message = statusElement.TryGetProperty("message", out JsonElement messageElement)
            ? messageElement.GetString() ?? string.Empty
            : string.Empty;

        return new AppStatusResponse
        {
            State = state,
            Message = message
        };
    }

    private sealed class DatabricksAppStatusResponse
    {
        public DatabricksAppStatus? AppStatus { get; set; }
    }

    private sealed class DatabricksAppStatus
    {
        public DatabricksComputeStatus? ComputeStatus { get; set; }
    }

    private sealed class DatabricksComputeStatus
    {
        public string? State { get; set; }
        public string? Message { get; set; }
    }

}
