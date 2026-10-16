using System.Text;
using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;
using Xorbix_Visual_Databricks_App_Builder.Services.Deployment;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Parsing;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public class DeployService : IDeployService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly IStreamlitTemplateService _templateService;
    private readonly IAppService _appService;
    private readonly IAppActionService _appActionService;
    private readonly ITenantLimitService _tenantLimitService;
    private readonly IDatabricksWorkspaceConnectionValidator _workspaceConnectionValidator;
    private readonly ILogger<DeployService> _logger;

    public DeployService(
        IDatabricksApiService databricksApi,
        IStreamlitTemplateService templateService,
        IAppService appService,
        IAppActionService appActionService,
        ITenantLimitService tenantLimitService,
        IDatabricksWorkspaceConnectionValidator workspaceConnectionValidator,
        ILogger<DeployService> logger)
    {
        _databricksApi = databricksApi;
        _templateService = templateService;
        _appService = appService;
        _appActionService = appActionService;
        _tenantLimitService = tenantLimitService;
        _workspaceConnectionValidator = workspaceConnectionValidator;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<StreamlitUploadResult>> UploadStreamlitAppAsync(Guid userId, Guid tenantId, StreamlitUploadRequest request)
    {
        var validation = ValidateUploadRequest(request);
        if (validation.IsFailed)
        {
            return validation.ToResult<StreamlitUploadResult>();
        }

        Result codeNameValidation = ValidateCodeNames(request.FormComponents ?? new List<VdabComponentDto>());
        if (codeNameValidation.IsFailed)
        {
            return codeNameValidation.ToResult<StreamlitUploadResult>();
        }

        var targetFolderPath = request.TargetPath!.TrimEnd('/');
        var createResult = await CreateWorkspaceFoldersAsync(
            userId,
            request.WorkspaceConnectionId,
            request.WorkspaceUrl!,
            targetFolderPath);
        if (createResult.IsFailed)
        {
            return Result.Fail<StreamlitUploadResult>(createResult.Errors);
        }

        var uploadState = new UploadState(targetFolderPath);

        await ApplyThemeConfigAsync(request, tenantId);
        int pageWidth = PageWidthBounds.Clamp(
            request.ThemeConfig?.PageWidth ?? PageWidthBounds.DefaultPixels);

        var appContentResult = _templateService.GenerateStreamlitAppFromVdabComponents(
            request.FormComponents ?? new List<VdabComponentDto>(),
            request.AppName,
            request.WorkflowDefinition,
            pageWidth);

        if (appContentResult.IsFailed)
        {
            return Result.Fail<StreamlitUploadResult>($"Failed to generate Streamlit app: {string.Join(", ", appContentResult.Errors.Select(e => e.Message))}");
        }

        await UploadArtifactAsync(userId, request.WorkspaceConnectionId, request.WorkspaceUrl!, uploadState, "app.py", appContentResult.Value);
        await UploadArtifactAsync(
            userId,
            request.WorkspaceConnectionId,
            request.WorkspaceUrl!,
            uploadState,
            "custom_modules.py",
            _templateService.GenerateCustomModulesFile(request.CustomModulesCode));
        if (WorkflowIncludesCallPrebuiltModule(request.WorkflowDefinition))
        {
            await UploadArtifactAsync(
                userId,
                request.WorkspaceConnectionId,
                request.WorkspaceUrl!,
                uploadState,
                PrebuiltModulesLibrary.FileName,
                PrebuiltModulesLibrary.GetContent());
        }

        await UploadArtifactAsync(userId, request.WorkspaceConnectionId, request.WorkspaceUrl!, uploadState, "requirements.txt", _templateService.GenerateRequirementsFile(request.FormComponents, request.WorkflowDefinition));
        await UploadArtifactAsync(
            userId,
            request.WorkspaceConnectionId,
            request.WorkspaceUrl!,
            uploadState,
            "app.yaml",
            _templateService.GenerateAppYamlFile(
                request.FormComponents,
                request.WorkflowDefinition,
                request.SqlWarehouseResourceKey));

        if (request.ThemeConfig != null)
        {
            await UploadArtifactAsync(
                userId,
                request.WorkspaceConnectionId,
                request.WorkspaceUrl!,
                uploadState,
                ".streamlit/config.toml",
                _templateService.GenerateStreamlitConfig(request.ThemeConfig));
        }

        return uploadState.BuildResult();
    }

    /// <inheritdoc/>
    public async Task<Result<DeployAppFromFolderResult>> DeployAppFromFolderAsync(Guid userId, DeployAppFromFolderRequest request)
    {
        var validation = ValidateDeployRequest(request);
        if (validation.IsFailed)
        {
            return validation.ToResult<DeployAppFromFolderResult>();
        }

        var databricksAppName = request.DatabricksAppName!;
        var deployRequest = new
        {
            mode = "SNAPSHOT",
            source_code_path = request.SourcePath
        };

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        };

        var response = await _databricksApi.PostAsync<DatabricksAppDeploymentResponse>(
            userId,
            request.WorkspaceConnectionId,
            request.WorkspaceUrl!,
            string.Format(DatabricksApiRoutes.AppsDeploymentsPathTemplate, databricksAppName),
            deployRequest,
            jsonOptions);

        if (response.IsFailed)
        {
            return Result.Fail<DeployAppFromFolderResult>(response.Errors);
        }

        return Result.Ok(new DeployAppFromFolderResult
        {
            Success = true,
            AppId = databricksAppName,
            DeploymentId = response.ValueOrDefault?.DeploymentId ?? "unknown",
            AppUrl = $"{request.WorkspaceUrl!.TrimEnd('/')}/apps/{databricksAppName}",
            Message = $"App '{databricksAppName}' deployed successfully!"
        });
    }

    /// <inheritdoc/>
    public async Task<Result<DeployAppFromFolderResult>> SimpleDeployAsync(SimpleDeployRequest request, Guid userId, Guid tenantId)
    {
        if (request.AppId <= 0)
        {
            return Result.Fail<DeployAppFromFolderResult>(new BadRequestError("AppId is required for deployment."));
        }

        var appResult = await _appService.GetAppByIdAsync(request.AppId, tenantId);
        if (appResult.IsFailed || appResult.ValueOrDefault == null)
        {
            return Result.Fail<DeployAppFromFolderResult>(new BadRequestError("App not found."));
        }

        var app = appResult.ValueOrDefault;

        if (app.TenantId.HasValue)
        {
            Result lockResult = await _tenantLimitService.EnsureSubscriptionActiveAsync(app.TenantId.Value);
            if (lockResult.IsFailed)
            {
                return Result.Fail<DeployAppFromFolderResult>(lockResult.Errors);
            }
        }

        var workspaceConnectionId = app.WorkspaceConnectionId;
        if (workspaceConnectionId <= 0)
        {
            return Result.Fail<DeployAppFromFolderResult>(new BadRequestError("App does not have a workspace connection configured."));
        }

        Result<DatabricksConnection> connectionResult =
            await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
        if (connectionResult.IsFailed)
        {
            return Result.Fail<DeployAppFromFolderResult>(connectionResult.Errors);
        }

        DatabricksConnection connection = connectionResult.Value;

        var databricksAppName = string.IsNullOrWhiteSpace(app.DatabricksAppName)
            ? request.DatabricksAppName
            : app.DatabricksAppName;

        if (string.IsNullOrWhiteSpace(databricksAppName))
        {
            return Result.Fail<DeployAppFromFolderResult>(new BadRequestError("Databricks app name is not configured for this app."));
        }

        Result genieGate = await GenieChatDeploymentValidator.ValidateAsync(
            userId,
            tenantId,
            request.AppId,
            request.FormComponents,
            _appActionService,
            _logger);
        if (genieGate.IsFailed)
        {
            return Result.Fail<DeployAppFromFolderResult>(genieGate.Errors);
        }

        Result modelChatGate = await ModelChatDeploymentValidator.ValidateAsync(
            userId,
            tenantId,
            request.AppId,
            request.FormComponents,
            _appActionService,
            _logger);
        if (modelChatGate.IsFailed)
        {
            return Result.Fail<DeployAppFromFolderResult>(modelChatGate.Errors);
        }

        Result<string> warehouseKeyResult = await SqlWarehouseDeploymentValidator.ResolveResourceKeyAsync(
            userId,
            tenantId,
            request.AppId,
            request.FormComponents,
            request.WorkflowDefinition,
            _appActionService,
            _logger);
        if (warehouseKeyResult.IsFailed)
        {
            return Result.Fail<DeployAppFromFolderResult>(warehouseKeyResult.Errors);
        }

        var uploadRequest = new StreamlitUploadRequest
        {
            WorkspaceConnectionId = workspaceConnectionId,
            WorkspaceUrl = connection.WorkspaceUrl,
            AppName = app.AppName,
            TargetPath = request.TargetPath,
            FormComponents = request.FormComponents ?? new List<VdabComponentDto>(),
            WorkflowDefinition = request.WorkflowDefinition,
            CustomModulesCode = app.CustomModulesCode,
            SqlWarehouseResourceKey = warehouseKeyResult.Value
        };

        var uploadResult = await UploadStreamlitAppAsync(userId, tenantId, uploadRequest);
        if (uploadResult.IsFailed)
        {
            return Result.Fail<DeployAppFromFolderResult>(new BadRequestError($"Upload failed: {string.Join(", ", uploadResult.Errors.Select(e => e.Message))}"));
        }

        var deployRequest = new DeployAppFromFolderRequest
        {
            WorkspaceConnectionId = workspaceConnectionId,
            WorkspaceUrl = connection.WorkspaceUrl,
            DatabricksAppName = databricksAppName,
            SourcePath = uploadResult.ValueOrDefault.UploadPath
        };

        var deployResult = await DeployAppFromFolderAsync(userId, deployRequest);
        if (deployResult.IsFailed)
        {
            return Result.Fail<DeployAppFromFolderResult>(new BadRequestError($"Deploy failed: {string.Join(", ", deployResult.Errors.Select(e => e.Message))}"));
        }

        return deployResult;
    }

    /// <inheritdoc/>
    public async Task<Result<GeneratedCodePreviewResult>> PreviewGeneratedCodeAsync(GeneratedCodePreviewRequest request, Guid userId, Guid tenantId)
    {
        _logger.LogInformation("Generating code preview for user {UserId}, app {AppId}", userId, request.AppId);

        Result validation = ValidatePreviewRequest(request);
        if (validation.IsFailed)
        {
            return validation.ToResult<GeneratedCodePreviewResult>();
        }

        List<VdabComponentDto> formComponents = request.FormComponents;
        Result codeNameValidation = ValidateCodeNames(formComponents);
        if (codeNameValidation.IsFailed)
        {
            return codeNameValidation.ToResult<GeneratedCodePreviewResult>();
        }

        string? sqlWarehouseResourceKey = null;
        if (request.AppId > 0)
        {
            Result genieGate = await GenieChatDeploymentValidator.ValidateAsync(
                userId,
                tenantId,
                request.AppId,
                formComponents,
                _appActionService,
                _logger);
            if (genieGate.IsFailed)
            {
                return genieGate.ToResult<GeneratedCodePreviewResult>();
            }

            Result modelChatGate = await ModelChatDeploymentValidator.ValidateAsync(
                userId,
                tenantId,
                request.AppId,
                formComponents,
                _appActionService,
                _logger);
            if (modelChatGate.IsFailed)
            {
                return modelChatGate.ToResult<GeneratedCodePreviewResult>();
            }

            Result<string> warehouseKeyGate = await SqlWarehouseDeploymentValidator.ResolveResourceKeyAsync(
                userId,
                tenantId,
                request.AppId,
                formComponents,
                request.WorkflowDefinition,
                _appActionService,
                _logger);
            if (warehouseKeyGate.IsFailed)
            {
                return warehouseKeyGate.ToResult<GeneratedCodePreviewResult>();
            }

            sqlWarehouseResourceKey = warehouseKeyGate.Value;
        }

        string appName = string.IsNullOrWhiteSpace(request.AppName)
            ? "Generated App"
            : request.AppName;

        WorkflowDefinitionDto effectiveWorkflowDefinition = request.WorkflowDefinition;
        List<string> previewErrors = new();

        StreamlitUploadRequest themeRequest = new StreamlitUploadRequest
        {
            AppName = appName,
            ThemeConfig = request.ThemeConfig
        };

        // Preview reflects the live theme the builder sends; only backfill from the
        // persisted app theme when the request omits a theme config entirely.
        if (themeRequest.ThemeConfig == null)
        {
            await ApplyThemeConfigAsync(themeRequest, tenantId);
        }

        int pageWidth = PageWidthBounds.Clamp(
            themeRequest.ThemeConfig?.PageWidth ?? PageWidthBounds.DefaultPixels);

        Result<string> generationResult = _templateService.GenerateStreamlitAppFromVdabComponents(
            formComponents,
            appName,
            effectiveWorkflowDefinition,
            pageWidth);
        if (generationResult.IsFailed)
        {
            previewErrors = generationResult.Errors
                .Select(error => error.Message)
                .Where(message => !string.IsNullOrWhiteSpace(message))
                .ToList();

            _logger.LogWarning(
                "Code preview generation skipped workflows for user {UserId}, app {AppId}. Errors: {Errors}",
                userId,
                request.AppId,
                string.Join("; ", previewErrors));

            effectiveWorkflowDefinition = new WorkflowDefinitionDto
            {
                Version = request.WorkflowDefinition?.Version ?? 1,
                Workflows = new List<WorkflowDto>()
            };

            generationResult = _templateService.GenerateStreamlitAppFromVdabComponents(
                formComponents,
                appName,
                effectiveWorkflowDefinition,
                pageWidth);
            if (generationResult.IsFailed)
            {
                return Result.Fail<GeneratedCodePreviewResult>(generationResult.Errors);
            }
        }

        string appCode = generationResult.Value;
        string requirements = _templateService.GenerateRequirementsFile(formComponents, effectiveWorkflowDefinition);
        string appYaml = _templateService.GenerateAppYamlFile(
            formComponents,
            effectiveWorkflowDefinition,
            sqlWarehouseResourceKey);
        string? customModulesRaw = await ResolveCustomModulesRawForPreviewAsync(request, tenantId);
        string customModules = _templateService.GenerateCustomModulesFile(customModulesRaw);

        List<GeneratedCodePreviewFile> files =
        [
            new GeneratedCodePreviewFile { Path = "app.py", Content = appCode },
            new GeneratedCodePreviewFile { Path = "custom_modules.py", Content = customModules },
            new GeneratedCodePreviewFile { Path = "requirements.txt", Content = requirements },
            new GeneratedCodePreviewFile { Path = "app.yaml", Content = appYaml }
        ];

        if (previewErrors.Count > 0)
        {
            files.Add(new GeneratedCodePreviewFile
            {
                Path = "preview-errors.txt",
                Content = BuildPreviewErrorsFile(previewErrors)
            });
        }

        if (themeRequest.ThemeConfig != null)
        {
            files.Add(new GeneratedCodePreviewFile
            {
                Path = ".streamlit/config.toml",
                Content = _templateService.GenerateStreamlitConfig(themeRequest.ThemeConfig)
            });
        }

        GeneratedCodePreviewResult result = new GeneratedCodePreviewResult
        {
            Files = files,
            PreviewErrors = previewErrors,
            PrebuiltModulesLibrarySource = PrebuiltModulesLibrary.GetContent(),
        };

        return Result.Ok(result);
    }

    private static bool WorkflowIncludesCallPrebuiltModule(WorkflowDefinitionDto? workflowDefinition)
    {
        if (workflowDefinition == null)
        {
            return false;
        }

        Result<WorkflowDefinitionModel> parsed = WorkflowDefinitionParser.Parse(workflowDefinition);
        if (parsed.IsFailed)
        {
            return false;
        }

        foreach (WorkflowModel workflow in parsed.Value.Workflows)
        {
            foreach (WorkflowActionNodeModel node in workflow.Nodes)
            {
                if (node.ActionType == WorkflowActionKind.CallPrebuiltModule)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static string BuildPreviewErrorsFile(IReadOnlyList<string> previewErrors)
    {
        StringBuilder sb = new();
        sb.AppendLine("Code preview generated with workflow errors.");
        sb.AppendLine();
        sb.AppendLine("The files in this preview were generated with invalid workflows disabled.");
        sb.AppendLine("Fix the workflow errors below, then reload the Code tab to preview workflow code.");
        sb.AppendLine();

        for (int index = 0; index < previewErrors.Count; index++)
        {
            sb.AppendLine($"{index + 1}. {previewErrors[index]}");
        }

        return sb.ToString();
    }

    private async Task<string?> ResolveCustomModulesRawForPreviewAsync(GeneratedCodePreviewRequest request, Guid tenantId)
    {
        if (request.CustomModulesCode != null)
        {
            return request.CustomModulesCode;
        }

        if (request.AppId > 0)
        {
            Result<AppDto?> appResult = await _appService.GetAppByIdAsync(request.AppId, tenantId);
            AppDto? app = appResult.ValueOrDefault;
            if (appResult.IsSuccess && app != null)
            {
                return app.CustomModulesCode;
            }
        }

        return null;
    }

    private static Result ValidateUploadRequest(StreamlitUploadRequest request)
    {
        if (request == null)
        {
            return Result.Fail(new BadRequestError("Request body is required."));
        }

        if (string.IsNullOrWhiteSpace(request.WorkspaceUrl))
        {
            return Result.Fail(new BadRequestError("Workspace URL is required."));
        }

        if (request.WorkspaceConnectionId <= 0)
        {
            return Result.Fail(new BadRequestError("Workspace connection ID is required."));
        }

        if (string.IsNullOrWhiteSpace(request.TargetPath))
        {
            return Result.Fail(new BadRequestError("Target path is required."));
        }

        return Result.Ok();
    }

    private static Result ValidateDeployRequest(DeployAppFromFolderRequest request)
    {
        if (request == null)
        {
            return Result.Fail(new BadRequestError("Request body is required."));
        }

        if (string.IsNullOrWhiteSpace(request.WorkspaceUrl))
        {
            return Result.Fail(new BadRequestError("Workspace URL is required."));
        }

        if (request.WorkspaceConnectionId <= 0)
        {
            return Result.Fail(new BadRequestError("Workspace connection ID is required."));
        }

        if (string.IsNullOrWhiteSpace(request.SourcePath))
        {
            return Result.Fail(new BadRequestError("Source path is required."));
        }

        if (string.IsNullOrWhiteSpace(request.DatabricksAppName))
        {
            return Result.Fail(new BadRequestError("Databricks app name is required."));
        }

        return Result.Ok();
    }

    private static Result ValidatePreviewRequest(GeneratedCodePreviewRequest request)
    {
        if (request == null)
        {
            return Result.Fail(new BadRequestError("Request body is required."));
        }

        if (request.FormComponents == null)
        {
            return Result.Fail(new BadRequestError("FormComponents is required."));
        }

        return Result.Ok();
    }

    private static Result ValidateCodeNames(List<VdabComponentDto> components)
    {
        List<(VdabComponentDto Component, int Index)> graphComponents = ResolveGraphComponents(components);
        Dictionary<string, List<(VdabComponentDto Component, int Index)>> namesByCodeName = new(StringComparer.OrdinalIgnoreCase);
        List<IError> errors = new();

        foreach ((VdabComponentDto component, int index) in graphComponents)
        {
            string codeName = component.CodeName?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(codeName))
            {
                string fieldPath = BuildCodeNameFieldPath(index);
                errors.Add(new CodeNameValidationError(
                    "codeName is required.",
                    fieldPath,
                    component.Id,
                    component.CodeName,
                    "Required"));
                continue;
            }

            if (!CodeNameUtility.IsValidPythonIdentifier(codeName))
            {
                string fieldPath = BuildCodeNameFieldPath(index);
                errors.Add(new CodeNameValidationError(
                    $"codeName '{codeName}' is invalid. Use a Python identifier pattern: ^[A-Za-z_][A-Za-z0-9_]*$.",
                    fieldPath,
                    component.Id,
                    codeName,
                    "InvalidFormat"));
                continue;
            }

            if (!namesByCodeName.TryGetValue(codeName, out List<(VdabComponentDto Component, int Index)>? existing))
            {
                namesByCodeName[codeName] = new List<(VdabComponentDto Component, int Index)> { (component, index) };
                continue;
            }

            existing.Add((component, index));
        }

        IEnumerable<KeyValuePair<string, List<(VdabComponentDto Component, int Index)>>> duplicates = namesByCodeName
            .Where(kvp => kvp.Value.Count > 1)
            .OrderBy(kvp => kvp.Key, StringComparer.OrdinalIgnoreCase);

        foreach (KeyValuePair<string, List<(VdabComponentDto Component, int Index)>> duplicate in duplicates)
        {
            List<(VdabComponentDto Component, int Index)> occurrences = duplicate.Value
                .OrderBy(entry => entry.Index)
                .ToList();

            foreach ((VdabComponentDto component, int index) in occurrences)
            {
                string fieldPath = BuildCodeNameFieldPath(index);
                errors.Add(new CodeNameValidationError(
                    $"Duplicate codeName '{duplicate.Key}' detected.",
                    fieldPath,
                    component.Id,
                    duplicate.Key,
                    "Duplicate"));
            }
        }

        return errors.Count == 0 ? Result.Ok() : Result.Fail(errors);
    }

    private static List<(VdabComponentDto Component, int Index)> ResolveGraphComponents(List<VdabComponentDto> components)
    {
        List<(VdabComponentDto Component, int Index)> indexedComponents = components
            .Select((component, index) => (Component: component, Index: index))
            .ToList();

        Dictionary<string, (VdabComponentDto Component, int Index)> byId = indexedComponents
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Component.Id))
            .GroupBy(entry => entry.Component.Id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        HashSet<string> childIds = indexedComponents
            .SelectMany(entry => entry.Component.Children ?? new List<string>())
            .Where(childId => !string.IsNullOrWhiteSpace(childId))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        List<(VdabComponentDto Component, int Index)> roots = indexedComponents
            .Where(entry => string.IsNullOrWhiteSpace(entry.Component.Id) || !childIds.Contains(entry.Component.Id))
            .OrderBy(entry => entry.Index)
            .ToList();

        List<(VdabComponentDto Component, int Index)> ordered = new();
        HashSet<string> visited = new(StringComparer.OrdinalIgnoreCase);

        foreach ((VdabComponentDto component, int index) in roots)
        {
            Traverse(component, index);
        }

        foreach ((VdabComponentDto component, int index) in indexedComponents.OrderBy(entry => entry.Index))
        {
            if (string.IsNullOrWhiteSpace(component.Id) || !visited.Contains(component.Id))
            {
                Traverse(component, index);
            }
        }

        return ordered;

        void Traverse(VdabComponentDto component, int index)
        {
            if (!string.IsNullOrWhiteSpace(component.Id) && !visited.Add(component.Id))
            {
                return;
            }

            ordered.Add((component, index));

            foreach (string childId in component.Children ?? new List<string>())
            {
                if (string.IsNullOrWhiteSpace(childId))
                {
                    continue;
                }

                if (byId.TryGetValue(childId, out (VdabComponentDto Component, int Index) childEntry))
                {
                    Traverse(childEntry.Component, childEntry.Index);
                }
            }
        }
    }

    private static string BuildCodeNameFieldPath(int index)
    {
        return $"formComponents[{index}].codeName";
    }

    private async Task ApplyThemeConfigAsync(StreamlitUploadRequest request, Guid tenantId)
    {
        if (string.IsNullOrWhiteSpace(request.AppName))
        {
            return;
        }

        var appResult = await _appService.GetAppByNameAsync(request.AppName, tenantId);
        if (appResult == null)
        {
            return;
        }

        if (appResult.IsFailed || appResult.ValueOrDefault == null)
        {
            return;
        }

        var appInfo = appResult.ValueOrDefault;
        if (string.IsNullOrWhiteSpace(appInfo.Theme))
        {
            return;
        }

        try
        {
            var themeData = JsonSerializer.Deserialize<Dictionary<string, string>>(appInfo.Theme);
            if (themeData == null)
            {
                return;
            }

            request.ThemeConfig ??= new StreamlitThemeConfig();
            if (themeData.TryGetValue("primaryColor", out var primaryColor))
            {
                request.ThemeConfig.PrimaryColor = primaryColor;
            }

            if (themeData.TryGetValue("backgroundColor", out var backgroundColor))
            {
                request.ThemeConfig.BackgroundColor = backgroundColor;
            }

            if (themeData.TryGetValue("secondaryBackgroundColor", out var secondaryBackgroundColor))
            {
                request.ThemeConfig.SecondaryBackgroundColor = secondaryBackgroundColor;
            }

            if (themeData.TryGetValue("textColor", out var textColor))
            {
                request.ThemeConfig.TextColor = textColor;
            }

            if (themeData.TryGetValue(PageWidthBounds.ThemeKey, out var pageWidthValue))
            {
                request.ThemeConfig.PageWidth = PageWidthBounds.Parse(pageWidthValue);
            }
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse app theme JSON: {Theme}", appInfo.Theme);
        }
    }

    private async Task<Result> CreateWorkspaceFoldersAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string folderPath)
    {
        var rootRequest = new { path = folderPath };
        Result<JsonElement> rootResult = await _databricksApi.PostAsync<JsonElement>(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            DatabricksApiRoutes.WorkspaceMkdirsPath,
            rootRequest);
        if (rootResult.IsFailed)
        {
            return Result.Fail(rootResult.Errors);
        }

        var streamlitRequest = new { path = $"{folderPath}/.streamlit" };
        Result<JsonElement> streamlitResult = await _databricksApi.PostAsync<JsonElement>(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            DatabricksApiRoutes.WorkspaceMkdirsPath,
            streamlitRequest);
        if (streamlitResult.IsFailed)
        {
            return Result.Fail(streamlitResult.Errors);
        }

        return Result.Ok();
    }

    private async Task UploadArtifactAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        UploadState state,
        string relativePath,
        string content)
    {
        var path = BuildWorkspacePath(state.TargetFolderPath, relativePath);
        Result uploadResult = await UploadFileToWorkspaceAsync(userId, workspaceConnectionId, workspaceUrl, path, content);
        if (uploadResult.IsSuccess)
        {
            state.RecordSuccess(path);
            return;
        }

        state.RecordFailure(relativePath, uploadResult.Errors);
    }

    private async Task<Result> UploadFileToWorkspaceAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string filePath,
        string content)
    {
        Result deleteResult = await DeleteFileIfExistsAsync(userId, workspaceConnectionId, workspaceUrl, filePath);
        if (deleteResult.IsFailed)
        {
            _logger.LogWarning(
                "Could not delete existing workspace file before upload at {FilePath}. Proceeding with overwrite. Errors={Errors}",
                filePath,
                string.Join(", ", deleteResult.Errors.Select(e => e.Message)));
        }

        var uploadRequest = new
        {
            path = filePath,
            content = Convert.ToBase64String(Encoding.UTF8.GetBytes(content)),
            format = ShouldUseBase64Format(filePath) ? "BASE64" : "AUTO",
            overwrite = true,
            language = ResolveLanguage(filePath)
        };

        Result<JsonElement> response = await _databricksApi.PostAsync<JsonElement>(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            DatabricksApiRoutes.WorkspaceImportPath,
            uploadRequest);
        return response.IsSuccess ? Result.Ok() : Result.Fail(response.Errors);
    }

    private async Task<Result> DeleteFileIfExistsAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string filePath)
    {
        var deleteRequest = new
        {
            path = filePath,
            recursive = false
        };

        Result<JsonElement> response = await _databricksApi.PostAsync<JsonElement>(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            DatabricksApiRoutes.WorkspaceDeletePath,
            deleteRequest);
        if (response.IsFailed)
        {
            _logger.LogDebug("Could not delete file {FilePath}: {Message}", filePath, string.Join(", ", response.Errors.Select(e => e.Message)));
            return Result.Fail(response.Errors);
        }

        return Result.Ok();
    }

    private static string ResolveLanguage(string filePath)
    {
        var extension = Path.GetExtension(filePath).ToLowerInvariant();
        var fileName = Path.GetFileName(filePath).ToLowerInvariant();

        return extension switch
        {
            ".py" when fileName.Contains("app.py") || fileName.Contains("custom_modules.py") || fileName.Contains("prebuilt_modules_library.py") || fileName.Contains("streamlit") => "TEXT",
            ".py" => "PYTHON",
            ".sql" => "SQL",
            ".scala" => "SCALA",
            ".r" => "R",
            ".md" => "MARKDOWN",
            ".txt" => "TEXT",
            ".yaml" or ".yml" => "TEXT",
            ".json" => "TEXT",
            _ => "TEXT"
        };
    }

    private static bool ShouldUseBase64Format(string filePath)
    {
        var extension = Path.GetExtension(filePath).ToLowerInvariant();
        var fileName = Path.GetFileName(filePath).ToLowerInvariant();
        return extension == ".py" && !fileName.Contains("app.py") && !fileName.Contains("custom_modules.py") && !fileName.Contains("prebuilt_modules_library.py") && !fileName.Contains("streamlit");
    }

    private static string BuildWorkspacePath(string folderPath, string relativePath)
    {
        return $"{folderPath.TrimEnd('/')}/{relativePath.TrimStart('/')}";
    }

    private sealed class UploadState
    {
        public UploadState(string targetFolderPath)
        {
            TargetFolderPath = targetFolderPath;
        }

        public string TargetFolderPath { get; }

        private readonly List<string> _uploadedFiles = new();
        private readonly List<string> _failedFiles = new();
        private readonly List<string> _errors = new();

        public void RecordSuccess(string path)
        {
            _uploadedFiles.Add(path);
        }

        public void RecordFailure(string fileName, IEnumerable<IError> errors)
        {
            _failedFiles.Add(fileName);
            _errors.AddRange(errors.Select(e => e.Message));
        }

        public Result<StreamlitUploadResult> BuildResult()
        {
            if (_failedFiles.Count == 0)
            {
                return Result.Ok(new StreamlitUploadResult
                {
                    Success = true,
                    UploadPath = TargetFolderPath,
                    Message = $"Successfully uploaded {_uploadedFiles.Count} files to Databricks workspace!"
                });
            }

            var detail = string.Join(", ", _failedFiles);
            return Result.Fail<StreamlitUploadResult>(new BadRequestError($"Uploaded {_uploadedFiles.Count} files successfully, but {_failedFiles.Count} files failed. Failed files: {detail}"));
        }
    }
}
