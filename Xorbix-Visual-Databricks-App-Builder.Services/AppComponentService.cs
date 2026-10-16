using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AppComponent;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Embedding.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services
{
    public class AppComponentService : IAppComponentService
    {
        private const string MainPageContextKey = "page_1"; // single-page assumption — update if multi-page support is added
        private const string ModalMetadataContextKey = "__modals";

        private static readonly JsonSerializerOptions DashboardEmbedPropsJsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        private readonly IAppComponentRepository _repository;
        private readonly IAppRepository _appRepository;
        private readonly IDatabricksConnectionRepository _databricksConnectionRepository;
        private readonly IAppService _appService;
        private readonly ILogger<AppComponentService> _logger;

        public AppComponentService(
            IAppComponentRepository repository,
            IAppRepository appRepository,
            IDatabricksConnectionRepository databricksConnectionRepository,
            IAppService appService,
            ILogger<AppComponentService> logger)
        {
            _repository = repository;
            _appRepository = appRepository;
            _databricksConnectionRepository = databricksConnectionRepository;
            _appService = appService;
            _logger = logger;
        }

        /// <inheritdoc/>
        public async Task<Result<Dictionary<string, List<AppComponentDto>>>> GetComponentsByContextAsync(int appId, Guid tenantId)
        {
            try
            {
                Result parentValidationResult = await EnsureParentAppInTenantAsync(appId, tenantId);
                if (parentValidationResult.IsFailed)
                {
                    return Result.Fail<Dictionary<string, List<AppComponentDto>>>(parentValidationResult.Errors);
                }

                _logger.LogInformation("Attempting to retrieve app components by context for app ID: {AppId}", appId);
                List<AppComponent> appComponents = (await _repository.GetByAppIdAsync(appId))
                    .OrderBy(component => component.PkId)
                    .ToList();

                Dictionary<int, AppComponentDto> dtoById = appComponents
                    .ToDictionary(component => component.PkId, MapToDto);

                // Pre-build child ID list to avoid re-parsing children JSON on each DFS re-entry.
                Dictionary<int, List<int>> childIdsByComponentId = new Dictionary<int, List<int>>();
                foreach (AppComponent component in appComponents)
                {
                    Result<List<int>> childResult = ParseChildIds(component);
                    if (childResult.IsFailed)
                    {
                        return Result.Fail<Dictionary<string, List<AppComponentDto>>>(childResult.Errors);
                    }

                    childIdsByComponentId[component.PkId] = childResult.Value;
                }

                List<AppComponent> modalComponents = appComponents
                    .Where(component => component.ComponentType == ComponentType.Modal)
                    .ToList();

                Dictionary<string, List<AppComponentDto>> contextGroups = new Dictionary<string, List<AppComponentDto>>
                {
                    [MainPageContextKey] = new List<AppComponentDto>(),
                    [ModalMetadataContextKey] = modalComponents.Select(component => dtoById[component.PkId]).ToList()
                };

                Dictionary<int, string> ownerContextByComponentId = new Dictionary<int, string>();

                foreach (AppComponent modalComponent in modalComponents)
                {
                    string modalContextKey = $"modal_{modalComponent.PkId}";
                    contextGroups[modalContextKey] = new List<AppComponentDto>();

                    foreach (int childId in childIdsByComponentId[modalComponent.PkId])
                    {
                        Result ownershipResult = AssignOwnershipByDepthFirstTraversal(
                            childId,
                            modalContextKey,
                            ownerContextByComponentId,
                            new HashSet<int>(),
                            childIdsByComponentId);

                        if (ownershipResult.IsFailed)
                        {
                            return Result.Fail<Dictionary<string, List<AppComponentDto>>>(ownershipResult.Errors);
                        }
                    }
                }

                foreach (AppComponent component in appComponents)
                {
                    if (component.ComponentType == ComponentType.Modal)
                    {
                        continue;
                    }

                    if (ownerContextByComponentId.TryGetValue(component.PkId, out string? ownerContextKey))
                    {
                        contextGroups[ownerContextKey].Add(dtoById[component.PkId]);
                        continue;
                    }

                    contextGroups[MainPageContextKey].Add(dtoById[component.PkId]);
                }

                _logger.LogInformation($"Successfully retrieved app components by context for app ID: {appId}");
                return Result.Ok(contextGroups);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve app components by context for app ID: {AppId}", appId);
                return Result.Fail<Dictionary<string, List<AppComponentDto>>>(new ExceptionalError("Database read failed.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<IEnumerable<AppComponentDto>>> GetAppComponentsByAppIdAsync(int appId)
        {
            try
            {
                _logger.LogInformation("Attempting to retrieve app components by app ID: {AppId}", appId);
                IEnumerable<AppComponent> appComponents = await _repository.GetByAppIdAsync(appId);

                IEnumerable<AppComponentDto> dtos = appComponents.Select(comp => new AppComponentDto
                {
                    Id = comp.PkId,
                    AppId = comp.AppId,
                    CodeName = comp.CodeName,
                    Description = comp.Description,
                    ComponentType = comp.ComponentType,
                    ComponentVersion = comp.ComponentVersion,
                    Properties = comp.Properties,
                    Bindings = comp.Bindings,
                    Children = comp.Children,
                    Layout = comp.Layout,
                    CreatedOn = comp.CreatedOn,
                    CreatedBy = comp.CreatedBy,
                    ModifiedOn = comp.ModifiedOn,
                    ModifiedBy = comp.ModifiedBy,
                    DeletedOn = comp.DeletedOn,
                    DeletedBy = comp.DeletedBy
                });

                _logger.LogInformation($"Successfully retrieved app components by app ID: {appId}");
                return Result.Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve app components by app ID: {AppId}", appId);
                return Result.Fail<IEnumerable<AppComponentDto>>(new ExceptionalError("Database read failed.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result> AddAppComponentAsync(AppComponent appComponent)
        {
            try
            {
                _logger.LogInformation("Attempting to add app component of type: {ComponentType}", appComponent.ComponentType);
                await _repository.AddAsync(appComponent);

                _logger.LogInformation("Successfully added app component of type: {ComponentType}", appComponent.ComponentType);
                return Result.Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to add app component of type: {ComponentType}", appComponent.ComponentType);
                return Result.Fail(new ExceptionalError($"Failed to add app component of type {appComponent.ComponentType}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result> UpdateAppComponentAsync(AppComponent appComponent)
        {
            try
            {
                _logger.LogInformation("Attempting to update app component of type: {ComponentType}", appComponent.ComponentType);

                // Check for existence first
                AppComponent? existing = await _repository.GetByIdAsync(appComponent.PkId);
                if (existing == null)
                {
                    _logger.LogWarning("App component with ID {AppComponentId} not found for update", appComponent.PkId);
                    return Result.Fail(new BadRequestError($"App component with ID {appComponent.PkId} not found"));
                }

                // Map incoming properties to existing entity (business logic)
                existing.Description = appComponent.Description;
                existing.CodeName = appComponent.CodeName;
                existing.ComponentType = appComponent.ComponentType;
                existing.ComponentVersion = appComponent.ComponentVersion;
                existing.Properties = appComponent.Properties;
                existing.Bindings = appComponent.Bindings;
                existing.Children = appComponent.Children;

                // Set ModifiedOn and ModifiedBy (business logic - should not rely on UI)
                existing.ModifiedOn = DateTime.UtcNow;
                // ModifiedBy can be set when user context is available

                await _repository.UpdateAsync(existing);
                _logger.LogInformation("Successfully updated app component of type: {ComponentType}", appComponent.ComponentType);
                return Result.Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update app component of type: {ComponentType}", appComponent.ComponentType);
                return Result.Fail(new ExceptionalError($"Failed to update app component of type {appComponent.ComponentType}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result> DeleteAppComponentAsync(int appComponentId, Guid actingUserId, Guid tenantId)
        {
            try
            {
                _logger.LogInformation("Attempting to delete app component by ID: {AppComponentId}", appComponentId);

                // Check for existence and deleted status (business logic)
                AppComponent? appComponent = await _repository.GetByIdAsync(appComponentId);
                if (appComponent == null)
                {
                    _logger.LogWarning("App component with ID {AppComponentId} not found for deletion", appComponentId);
                    return Result.Fail(new NotFoundError($"App component with ID {appComponentId} not found"));
                }

                if (appComponent.DeletedOn != null)
                {
                    _logger.LogWarning("App component with ID {AppComponentId} has already been deleted", appComponentId);
                    return Result.Fail(new BadRequestError($"App component with ID {appComponentId} has already been deleted"));
                }

                Result parentValidationResult = await EnsureParentAppInTenantAsync(appComponent.AppId, tenantId);
                if (parentValidationResult.IsFailed)
                {
                    return Result.Fail(parentValidationResult.Errors);
                }

                await _repository.DeleteAsync(appComponent);
                await TouchParentAppAsync(appComponent.AppId, actingUserId);
                _logger.LogInformation("Successfully deleted app component by ID: {AppComponentId}", appComponentId);
                return Result.Ok();
            }
            catch (Exception ex)
            {   
                _logger.LogError(ex, "Failed to delete app component by ID: {AppComponentId}", appComponentId);
                return Result.Fail(new ExceptionalError($"Failed to delete app component ID {appComponentId}.", ex));
            }
        }

        /// <inheritdoc/>
        public Task<Result<AppComponentDto>> UpsertAppComponentAsync(int appId, UpsertAppComponentRequest request, Guid actingUserId, Guid tenantId)
        {
            return UpsertAppComponentAsync(appId, request, deferParentTouch: false, actingUserId, tenantId);
        }

        private async Task<Result<AppComponentDto>> UpsertAppComponentAsync(int appId, UpsertAppComponentRequest request, bool deferParentTouch, Guid actingUserId, Guid tenantId)
        {
            Result parentValidationResult = await EnsureParentAppInTenantAsync(appId, tenantId);
            if (parentValidationResult.IsFailed)
            {
                return Result.Fail<AppComponentDto>(parentValidationResult.Errors);
            }

            Result<AppComponentDto> result = await UpsertAppComponentCoreAsync(appId, request);
            if (!deferParentTouch && result.IsSuccess)
            {
                await TouchParentAppAsync(appId, actingUserId);
            }

            return result;
        }

        private async Task TouchParentAppAsync(int appId, Guid actingUserId)
        {
            await _appRepository.TouchModifiedUtcAsync(appId, actingUserId);
        }

        private async Task<Result<AppComponentDto>> UpsertAppComponentCoreAsync(int appId, UpsertAppComponentRequest request)
        {
            try
            {
                _logger.LogInformation("Attempting to upsert app component of type: {ComponentType} for app ID: {AppId}", request.ComponentType, appId);

                App? app = await _appRepository.GetByIdAsync(appId);
                Result appResult = ValidateAppExistsForUpsert(app, appId);
                if (appResult.IsFailed)
                {
                    _logger.LogWarning("App with ID {AppId} not found", appId);
                    return Result.Fail<AppComponentDto>(appResult.Errors);
                }

                Result componentTypeResult = ValidateComponentTypeDefinedForUpsert(request.ComponentType);
                if (componentTypeResult.IsFailed)
                {
                    _logger.LogWarning("Invalid ComponentType: {ComponentType}", request.ComponentType);
                    return Result.Fail<AppComponentDto>(componentTypeResult.Errors);
                }

                Result propertiesResult = ValidatePropertiesNotEmptyForUpsert(request.Properties);
                if (propertiesResult.IsFailed)
                {
                    _logger.LogWarning("Properties JSON cannot be empty");
                    return Result.Fail<AppComponentDto>(propertiesResult.Errors);
                }

                Result tabsResult = ValidateTabsComponentForUpsert(request.ComponentType, request.Properties);
                if (tabsResult.IsFailed)
                {
                    string errorMessage = tabsResult.Errors.First().Message;
                    _logger.LogWarning("Invalid Tabs properties: {Error}", errorMessage);
                    return Result.Fail<AppComponentDto>(new BadRequestError(errorMessage));
                }

                Result chartResult = ValidateChartValueAxisForUpsert(request);
                if (chartResult.IsFailed)
                {
                    string errorMessage = chartResult.Errors.First().Message;
                    _logger.LogWarning("Invalid chart value axis: {Error}", errorMessage);
                    return Result.Fail<AppComponentDto>(new BadRequestError(errorMessage));
                }

                Result embedResult = await ValidateDashboardEmbedComponentForUpsertAsync(
                    request.ComponentType,
                    request.Properties,
                    app!,
                    _logger);
                if (embedResult.IsFailed)
                {
                    return Result.Fail<AppComponentDto>(embedResult.Errors);
                }

                Result genieChatResult = ValidateGenieChatComponentForUpsert(request.ComponentType, request.Properties);
                if (genieChatResult.IsFailed)
                {
                    return Result.Fail<AppComponentDto>(genieChatResult.Errors);
                }

                Result modelChatResult = ValidateModelChatComponentForUpsert(request.ComponentType, request.Properties);
                if (modelChatResult.IsFailed)
                {
                    return Result.Fail<AppComponentDto>(modelChatResult.Errors);
                }

                Result layoutResult = ValidateLayoutJsonIfProvided(request.Layout);
                if (layoutResult.IsFailed)
                {
                    _logger.LogWarning("Invalid Layout JSON: {Layout}", request.Layout);
                    return Result.Fail<AppComponentDto>(layoutResult.Errors);
                }

                AppComponent appComponent;

                if (request.Id.HasValue && request.Id.Value > 0)
                {
                    // Update existing entity
                    AppComponent? existing = await _repository.GetByIdAsync(request.Id.Value);
                    if (existing == null)
                    {
                        _logger.LogWarning("App component with ID {AppComponentId} not found for update", request.Id.Value);
                        return Result.Fail<AppComponentDto>(new NotFoundError($"App component with ID {request.Id.Value} not found"));
                    }

                    // Map properties to existing entity
                    existing.Description = request.Description;
                    existing.CodeName = request.CodeName;
                    existing.ComponentType = request.ComponentType;
                    existing.ComponentVersion = request.ComponentVersion;
                    existing.Properties = request.Properties;
                    existing.Bindings = request.Bindings;
                    existing.Children = request.Children;
                    existing.Layout = request.Layout;
                    existing.ModifiedOn = DateTime.UtcNow;

                    appComponent = existing;
                }
                else
                {
                    // Create new entity
                    appComponent = new AppComponent
                    {
                        AppId = appId,
                        Description = request.Description,
                        CodeName = request.CodeName,
                        ComponentType = request.ComponentType,
                        ComponentVersion = request.ComponentVersion,
                        Properties = request.Properties,
                        Bindings = request.Bindings,
                        Children = request.Children,
                        Layout = request.Layout,
                        CreatedOn = DateTime.UtcNow
                    };
                }

                // Save the component
                if (request.Id.HasValue && request.Id.Value > 0)
                {
                    await _repository.UpdateAsync(appComponent);
                }
                else
                {
                    await _repository.AddAsync(appComponent);
                }

                AppComponent saved = appComponent;

                AppComponentDto dto = new AppComponentDto
                {
                    Id = saved.PkId,
                    AppId = saved.AppId,
                    FrontendId = request.FrontendId,
                    CodeName = saved.CodeName,
                    Description = saved.Description,
                    ComponentType = saved.ComponentType,
                    ComponentVersion = saved.ComponentVersion,
                    Properties = saved.Properties,
                    Bindings = saved.Bindings,
                    Children = saved.Children,
                    Layout = saved.Layout,
                    CreatedOn = saved.CreatedOn,
                    CreatedBy = saved.CreatedBy,
                    ModifiedOn = saved.ModifiedOn,
                    ModifiedBy = saved.ModifiedBy,
                    DeletedOn = saved.DeletedOn,
                    DeletedBy = saved.DeletedBy
                };

                _logger.LogInformation("Successfully upserted app component of type: {ComponentType} with ID: {Id}", saved.ComponentType, saved.PkId);
                return Result.Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upsert app component of type: {ComponentType}", request.ComponentType);
                return Result.Fail<AppComponentDto>(new ExceptionalError($"Failed to upsert app component of type {request.ComponentType}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<IEnumerable<AppComponentDto>>> UpsertAppComponentsBatchAsync(int appId, IEnumerable<UpsertAppComponentRequest> requests, Guid actingUserId, Guid tenantId)
        {
            try
            {
                _logger.LogInformation("Attempting to upsert {Count} app components for app ID: {AppId}", requests.Count(), appId);

                Result parentValidationResult = await EnsureParentAppInTenantAsync(appId, tenantId);
                if (parentValidationResult.IsFailed)
                {
                    return Result.Fail<IEnumerable<AppComponentDto>>(parentValidationResult.Errors);
                }

                List<AppComponentDto> results = new List<AppComponentDto>();

                foreach (UpsertAppComponentRequest request in requests)
                {
                    Result<AppComponentDto> result = await UpsertAppComponentAsync(appId, request, deferParentTouch: true, actingUserId, tenantId);
                    if (result.IsFailed)
                    {
                        _logger.LogWarning("Failed to upsert component of type {ComponentType}: {Error}", request.ComponentType, result.Errors.First().Message);
                        // Continue processing other components instead of failing the entire batch
                        continue;
                    }

                    results.Add(result.Value);
                }

                if (results.Count > 0)
                {
                    await TouchParentAppAsync(appId, actingUserId);
                }

                _logger.LogInformation("Successfully upserted {Count} app components for app ID: {AppId}", results.Count, appId);
                return Result.Ok<IEnumerable<AppComponentDto>>(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upsert app components batch for app ID: {AppId}", appId);
                return Result.Fail<IEnumerable<AppComponentDto>>(new ExceptionalError($"Failed to upsert app components batch for app {appId}.", ex));
            }
        }

        private static AppComponentDto MapToDto(AppComponent component)
        {
            return new AppComponentDto
            {
                Id = component.PkId,
                AppId = component.AppId,
                CodeName = component.CodeName,
                Description = component.Description,
                ComponentType = component.ComponentType,
                ComponentVersion = component.ComponentVersion,
                Properties = component.Properties,
                Bindings = component.Bindings,
                Children = component.Children,
                Layout = component.Layout,
                CreatedOn = component.CreatedOn,
                CreatedBy = component.CreatedBy,
                ModifiedOn = component.ModifiedOn,
                ModifiedBy = component.ModifiedBy,
                DeletedOn = component.DeletedOn,
                DeletedBy = component.DeletedBy
            };
        }

        private async Task<Result> EnsureParentAppInTenantAsync(int appId, Guid tenantId)
        {
            Result<AppDto?> appResult = await _appService.GetAppByIdAsync(appId, tenantId);
            if (appResult.IsFailed)
            {
                return Result.Fail(appResult.Errors);
            }

            if (appResult.ValueOrDefault == null)
            {
                return Result.Fail(new NotFoundError($"App with ID {appId} not found"));
            }

            return Result.Ok();
        }

        private static Result AssignOwnershipByDepthFirstTraversal(
            int componentId,
            string ownerContextKey,
            Dictionary<int, string> ownerContextByComponentId,
            HashSet<int> activePath,
            Dictionary<int, List<int>> childIdsByComponentId)
        {
            if (activePath.Contains(componentId))
            {
                return Result.Fail(new BadRequestError($"Cycle detected while resolving ownership for component {componentId}."));
            }

            if (!childIdsByComponentId.TryGetValue(componentId, out List<int>? childIds))
            {
                return Result.Fail(new BadRequestError($"Component reference {componentId} does not exist."));
            }

            if (ownerContextByComponentId.TryGetValue(componentId, out string? existingOwnerContextKey))
            {
                if (existingOwnerContextKey != ownerContextKey)
                {
                    return Result.Fail(
                        new BadRequestError(
                            $"Component {componentId} is owned by multiple contexts: '{existingOwnerContextKey}' and '{ownerContextKey}'."));
                }

                return Result.Ok();
            }

            ownerContextByComponentId[componentId] = ownerContextKey;
            activePath.Add(componentId);

            foreach (int childId in childIds)
            {
                Result childOwnershipResult = AssignOwnershipByDepthFirstTraversal(
                    childId,
                    ownerContextKey,
                    ownerContextByComponentId,
                    activePath,
                    childIdsByComponentId);

                if (childOwnershipResult.IsFailed)
                {
                    return childOwnershipResult;
                }
            }

            activePath.Remove(componentId);
            return Result.Ok();
        }

        private static Result<List<int>> ParseChildIds(AppComponent component)
        {
            if (string.IsNullOrWhiteSpace(component.Children))
            {
                return Result.Ok(new List<int>());
            }

            List<string>? childIdTokens;
            try
            {
                childIdTokens = System.Text.Json.JsonSerializer.Deserialize<List<string>>(component.Children);
            }
            catch (Exception ex)
            {
                return Result.Fail<List<int>>(new BadRequestError($"Invalid children JSON for component {component.PkId}: {ex.Message}"));
            }

            if (childIdTokens == null)
            {
                return Result.Ok(new List<int>());
            }

            List<int> childIds = new List<int>();
            foreach (string token in childIdTokens)
            {
                if (string.IsNullOrWhiteSpace(token))
                {
                    continue;
                }

                if (!int.TryParse(token, out int parsedChildId))
                {
                    return Result.Fail<List<int>>(
                        new BadRequestError($"Invalid child component ID '{token}' on component {component.PkId}."));
                }

                childIds.Add(parsedChildId);
            }

            return Result.Ok(childIds);
        }

        private static Result ValidateAppExistsForUpsert(App? app, int appId)
        {
            if (app == null)
            {
                return Result.Fail(new NotFoundError($"App with ID {appId} not found"));
            }

            return Result.Ok();
        }

        private static Result ValidateComponentTypeDefinedForUpsert(ComponentType componentType)
        {
            if (!Enum.IsDefined(typeof(ComponentType), componentType))
            {
                return Result.Fail(new BadRequestError($"Invalid ComponentType: {componentType}"));
            }

            return Result.Ok();
        }

        private static Result ValidatePropertiesNotEmptyForUpsert(string? properties)
        {
            if (string.IsNullOrWhiteSpace(properties))
            {
                return Result.Fail(new BadRequestError("Properties JSON cannot be empty"));
            }

            return Result.Ok();
        }

        private static Result ValidateTabsComponentForUpsert(ComponentType componentType, string propertiesJson)
        {
            if (componentType != ComponentType.Tabs)
            {
                return Result.Ok();
            }

            return ValidateTabsProperties(propertiesJson);
        }

        private static Result ValidateChartValueAxisForUpsert(UpsertAppComponentRequest request)
        {
            return ChartValueAxisValidator.ValidateValueAxisForUpsert(
                request.ComponentType,
                request.Properties,
                request.Bindings);
        }

        private static Result ValidateGenieChatComponentForUpsert(ComponentType componentType, string propertiesJson)
        {
            if (componentType != ComponentType.GenieChat)
            {
                return Result.Ok();
            }

            try
            {
                GenieChatProps? props = JsonSerializer.Deserialize<GenieChatProps>(propertiesJson, DashboardEmbedPropsJsonOptions);
                if (props == null)
                {
                    return Result.Fail(new BadRequestError("Genie Chat properties are invalid."));
                }
            }
            catch (JsonException ex)
            {
                return Result.Fail(new BadRequestError($"Genie Chat properties are invalid JSON: {ex.Message}"));
            }

            return Result.Ok();
        }

        private static Result ValidateModelChatComponentForUpsert(ComponentType componentType, string propertiesJson)
        {
            if (componentType != ComponentType.ModelChat)
            {
                return Result.Ok();
            }

            try
            {
                ModelChatProps? props = JsonSerializer.Deserialize<ModelChatProps>(propertiesJson, DashboardEmbedPropsJsonOptions);
                if (props == null)
                {
                    return Result.Fail(new BadRequestError("Model Chat properties are invalid."));
                }
            }
            catch (JsonException ex)
            {
                return Result.Fail(new BadRequestError($"Model Chat properties are invalid JSON: {ex.Message}"));
            }

            return Result.Ok();
        }

        private async Task<Result> ValidateDashboardEmbedComponentForUpsertAsync(
            ComponentType componentType,
            string propertiesJson,
            App app,
            ILogger logger)
        {
            if (componentType != ComponentType.DashboardEmbed)
            {
                return Result.Ok();
            }

            DashboardEmbedProps? embedProps;
            try
            {
                embedProps = JsonSerializer.Deserialize<DashboardEmbedProps>(propertiesJson, DashboardEmbedPropsJsonOptions);
            }
            catch (JsonException ex)
            {
                logger.LogWarning(ex, "Invalid Dashboard embed properties JSON");
                return Result.Fail(new BadRequestError(
                    "Dashboard embed properties are invalid. Check src, height, and scrolling in the builder."));
            }

            if (embedProps != null && !string.IsNullOrWhiteSpace(embedProps.Src))
            {
                if (app.WorkspaceConnectionId <= 0)
                {
                    return Result.Fail(new BadRequestError(
                        "Configure a workspace connection for this app before setting a dashboard embed URL."));
                }

                DatabricksConnection? connection = await _databricksConnectionRepository.GetByIdAsync(app.WorkspaceConnectionId);
                if (connection == null || string.IsNullOrWhiteSpace(connection.WorkspaceUrl))
                {
                    return Result.Fail(new BadRequestError(
                        "Workspace URL is missing for this app. Configure the workspace connection and try again."));
                }

                Result embedUrlResult = DatabricksDashboardEmbedUrlValidator.Validate(embedProps.Src, connection.WorkspaceUrl);
                if (embedUrlResult.IsFailed)
                {
                    string errorMessage = embedUrlResult.Errors.First().Message;
                    logger.LogWarning("Invalid dashboard embed URL: {Error}", errorMessage);
                    return Result.Fail(new BadRequestError(errorMessage));
                }
            }

            return Result.Ok();
        }

        private static Result ValidateLayoutJsonIfProvided(string? layout)
        {
            if (string.IsNullOrEmpty(layout))
            {
                return Result.Ok();
            }

            try
            {
                JsonDocument.Parse(layout);
                return Result.Ok();
            }
            catch (Exception ex)
            {
                return Result.Fail(new BadRequestError($"Invalid Layout JSON: {ex.Message}"));
            }
        }

        private static Result ValidateTabsProperties(string propertiesJson)
        {
            try
            {
                const int MaxTabNameLength = 100;
                TabsProps? tabsProps = System.Text.Json.JsonSerializer.Deserialize<TabsProps>(
                    propertiesJson,
                    new System.Text.Json.JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

                if (tabsProps == null)
                {
                    return Result.Fail("Tabs properties are required.");
                }

                if (tabsProps.Tabs == null || tabsProps.Tabs.Count < 1)
                {
                    return Result.Fail("Tabs component must contain at least one tab.");
                }

                bool hasEmptyTabName = tabsProps.Tabs.Any(tabName => string.IsNullOrWhiteSpace(tabName));
                if (hasEmptyTabName)
                {
                    return Result.Fail("Tabs component cannot contain empty tab names.");
                }

                bool hasTooLongTabName = tabsProps.Tabs.Any(tabName => tabName.Trim().Length > MaxTabNameLength);
                if (hasTooLongTabName)
                {
                    return Result.Fail($"Tabs component tab names must be {MaxTabNameLength} characters or fewer.");
                }

                if (tabsProps.DefaultTabIndex.HasValue)
                {
                    int defaultTabIndex = tabsProps.DefaultTabIndex.Value;
                    if (defaultTabIndex < 0 || defaultTabIndex >= tabsProps.Tabs.Count)
                    {
                        return Result.Fail("Tabs component default tab index must reference an existing tab.");
                    }
                }

                return Result.Ok();
            }
            catch (Exception ex)
            {
                return Result.Fail($"Invalid Tabs properties JSON: {ex.Message}");
            }
        }
    }
}
