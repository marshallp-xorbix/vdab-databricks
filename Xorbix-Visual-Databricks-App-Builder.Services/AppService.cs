using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using FluentResults;

using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services
{
    public class AppService : IAppService
    {
        private readonly IAppRepository _repository;
        private readonly ILogger<AppService> _logger;
        private readonly IDatabricksApiService _databricksApi;
        private readonly IDatabricksWorkspaceConnectionValidator _workspaceConnectionValidator;
        private readonly IDatabricksAppProvisioningService _databricksAppProvisioningService;
        private readonly ITenantLimitService _tenantLimitService;
        private readonly ITenantResourceGuard _tenantResourceGuard;

        private static readonly JsonSerializerOptions SnakeCaseOptions = new JsonSerializerOptions()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        public AppService(
            IAppRepository repository,
            ILogger<AppService> logger,
            IDatabricksApiService databricksApi,
            IDatabricksWorkspaceConnectionValidator workspaceConnectionValidator,
            IDatabricksAppProvisioningService databricksAppProvisioningService,
            ITenantLimitService tenantLimitService,
            ITenantResourceGuard tenantResourceGuard)
        {
            _repository = repository;
            _logger = logger;
            _databricksApi = databricksApi;
            _workspaceConnectionValidator = workspaceConnectionValidator;
            _databricksAppProvisioningService = databricksAppProvisioningService;
            _tenantLimitService = tenantLimitService;
            _tenantResourceGuard = tenantResourceGuard;
        }

        /// <inheritdoc/>
        public async Task<Result<AppDto?>> GetAppByIdAsync(int appId, Guid tenantId)
        {
            try
            {
                _logger.LogInformation("Attempting to retrieve app by ID: {AppId}", appId);
                App? app = await _repository.GetByIdAsync(appId);

                if (app == null)
                {
                    _logger.LogInformation("App not found by ID: {AppId}", appId);
                    return Result.Ok<AppDto?>(null);
                }

                AppDto dto = new AppDto
                {
                    Id = app.PkId,
                    OwnerId = app.OwnerId,
                    OwnerEmail = app.User?.Email,
                    AppName = app.AppName,
                    DatabricksAppName = app.DatabricksAppName,
                    Description = app.Description,
                    TenantId = app.TenantId,
                    WorkspaceConnectionId = app.WorkspaceConnectionId,
                    WorkspacePath = app.WorkspacePath,
                    Version = app.Version,
                    LastPublishedAt = app.LastPublishedAt,
                    WorkflowDefinition = app.WorkflowDefinition,
                    CustomModulesCode = app.CustomModulesCode,
                    CreatedOn = app.CreatedOn,
                    CreatedBy = app.CreatedBy,
                    ModifiedOn = app.ModifiedOn,
                    ModifiedBy = app.ModifiedBy,
                    DeletedOn = app.DeletedOn,
                    DeletedBy = app.DeletedBy,
                    Theme = app.Theme
                };

                Result tenantGuardResult = _tenantResourceGuard.EnsureAppInTenant(dto, tenantId);
                if (tenantGuardResult.IsFailed)
                {
                    return Result.Fail<AppDto?>(tenantGuardResult.Errors);
                }

                _logger.LogInformation($"Successfully retrieved app by ID: {appId}");
                return Result.Ok<AppDto?>(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve app by ID: {AppId}", appId);
                return Result.Fail<AppDto?>(new ExceptionalError("Database read failed.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result<IEnumerable<AppDto>>> GetAppsByTenantIdAsync(Guid tenantId)
        {
            // TODO: Implement creator-level permissions so owners can control access for other users.
            try
            {
                _logger.LogInformation("Attempting to retrieve apps by tenant ID: {TenantId}", tenantId);
                IEnumerable<App> apps = await _repository.GetByTenantIdAsync(tenantId);

                IEnumerable<AppDto> dtos = apps.Select(app => new AppDto
                {
                    Id = app.PkId,
                    OwnerId = app.OwnerId,
                    AppName = app.AppName,
                    DatabricksAppName = app.DatabricksAppName,
                    Description = app.Description,
                    TenantId = app.TenantId,
                    WorkspaceConnectionId = app.WorkspaceConnectionId,
                    WorkspacePath = app.WorkspacePath,
                    Version = app.Version,
                    LastPublishedAt = app.LastPublishedAt,
                    WorkflowDefinition = app.WorkflowDefinition,
                    CustomModulesCode = app.CustomModulesCode,
                    CreatedOn = app.CreatedOn,
                    CreatedBy = app.CreatedBy,
                    ModifiedOn = app.ModifiedOn,
                    ModifiedBy = app.ModifiedBy,
                    DeletedOn = app.DeletedOn,
                    DeletedBy = app.DeletedBy,
                    Theme = app.Theme
                });

                _logger.LogInformation("Successfully retrieved apps by tenant ID: {TenantId}", tenantId);
                return Result.Ok<IEnumerable<AppDto>>(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve apps by tenant ID: {TenantId}", tenantId);
                return Result.Fail<IEnumerable<AppDto>>(new ExceptionalError($"Failed to retrieve apps for tenant {tenantId}.", ex));
            }
        }

        public async Task<Result<AppDto?>> GetAppByNameAsync(string appName, Guid tenantId)
        {
            try
            {
                _logger.LogInformation("Attempting to retrieve app by name: {AppName}", appName);
                App? app = await _repository.GetByNameAsync(appName); // You need to add this repo method
                if (app == null)
                {
                    _logger.LogInformation("App not found by name: {AppName}", appName);
                    return Result.Ok<AppDto?>(null);
                }

                AppDto dto = new AppDto
                {
                    Id = app.PkId,
                    OwnerId = app.OwnerId,
                    AppName = app.AppName,
                    DatabricksAppName = app.DatabricksAppName,
                    Description = app.Description,
                    TenantId = app.TenantId,
                    WorkspaceConnectionId = app.WorkspaceConnectionId,
                    WorkspacePath = app.WorkspacePath,
                    Version = app.Version,
                    LastPublishedAt = app.LastPublishedAt,
                    WorkflowDefinition = app.WorkflowDefinition,
                    CustomModulesCode = app.CustomModulesCode,
                    Theme = app.Theme,
                    CreatedOn = app.CreatedOn,
                    CreatedBy = app.CreatedBy,
                    ModifiedOn = app.ModifiedOn,
                    ModifiedBy = app.ModifiedBy,
                    DeletedOn = app.DeletedOn,
                    DeletedBy = app.DeletedBy
                };

                Result tenantGuardResult = _tenantResourceGuard.EnsureAppInTenant(dto, tenantId);
                if (tenantGuardResult.IsFailed)
                {
                    return Result.Fail<AppDto?>(tenantGuardResult.Errors);
                }

                _logger.LogInformation("Successfully retrieved app by name: {AppName}", appName);
                return Result.Ok<AppDto?>(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve app by name: {AppName}", appName);
                return Result.Fail<AppDto?>(new ExceptionalError("Database read failed.", ex));
            }
        }


        /// <inheritdoc/>
        public async Task<Result<AppDto>> CreateAppAsync(CreateAppRequest request, Guid ownerId, Guid tenantId)
        {
            const string userSafeUpstreamMessage =
                "Unable to complete Databricks app setup for this workspace. Please verify your workspace connection and try again.";

            if (request == null)
            {
                return Result.Fail<AppDto>(new BadRequestError("Request cannot be null."));
            }

            if (ownerId == Guid.Empty)
            {
                return Result.Fail<AppDto>(new BadRequestError("OwnerId is required."));
            }

            if (tenantId == Guid.Empty)
            {
                return Result.Fail<AppDto>(new BadRequestError("TenantId is required."));
            }

            if (string.IsNullOrWhiteSpace(request.AppName))
            {
                return Result.Fail<AppDto>(new BadRequestError("AppName is required."));
            }

            if (request.WorkspaceConnectionId <= 0)
            {
                return Result.Fail<AppDto>(new BadRequestError("workspaceConnectionId must be greater than 0."));
            }

            Result limitResult = await _tenantLimitService.EnsureCanCreateAppAsync(tenantId);
            if (limitResult.IsFailed)
            {
                return Result.Fail<AppDto>(limitResult.Errors);
            }

            Result<DatabricksConnection> connectionResult =
                await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(
                    tenantId,
                    request.WorkspaceConnectionId);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<AppDto>(connectionResult.Errors);
            }

            DatabricksConnection connection = connectionResult.Value;
            string? databricksAppName = null;
            string? createdDatabricksAppName = null;

            if (request.DatabricksAppMode == DatabricksAppCreationMode.LinkExisting)
            {
                string? requestedDatabricksAppName = request.DatabricksAppName?.Trim();
                if (string.IsNullOrWhiteSpace(requestedDatabricksAppName))
                {
                    return Result.Fail<AppDto>(
                        new BadRequestError("DatabricksAppName is required when databricksAppMode is linkExisting."));
                }

                Result<DatabricksAppResponse?> databricksAppResult =
                    await _databricksApi.GetDatabricksAppByNameAsync(
                        ownerId,
                        request.WorkspaceConnectionId,
                        connection.WorkspaceUrl,
                        requestedDatabricksAppName,
                        SnakeCaseOptions);
                if (databricksAppResult.IsFailed)
                {
                    _logger.LogError(
                        "Databricks app lookup failed during create. WorkspaceConnectionId={WorkspaceConnectionId}, RequestedDatabricksAppName={DatabricksAppName}, Errors={Errors}",
                        request.WorkspaceConnectionId,
                        requestedDatabricksAppName,
                        string.Join("; ", databricksAppResult.Errors.Select(e => e.Message)));
                    return Result.Fail<AppDto>(new UpstreamDependencyError(userSafeUpstreamMessage));
                }

                DatabricksAppResponse? databricksApp = databricksAppResult.ValueOrDefault;
                if (databricksApp == null)
                {
                    return Result.Fail<AppDto>(
                        new BadRequestError($"Databricks app '{requestedDatabricksAppName}' was not found for the selected workspace connection."));
                }

                databricksAppName = string.IsNullOrWhiteSpace(databricksApp.Name)
                    ? requestedDatabricksAppName
                    : databricksApp.Name.Trim();
            }
            else if (request.DatabricksAppMode == DatabricksAppCreationMode.CreateNew)
            {
                string? requestedDatabricksAppName = request.DatabricksAppName?.Trim();
                if (string.IsNullOrWhiteSpace(requestedDatabricksAppName))
                {
                    return Result.Fail<AppDto>(
                        new BadRequestError("DatabricksAppName is required when databricksAppMode is createNew."));
                }

                Result<CreatedDatabricksAppDto> createResult = await _databricksAppProvisioningService.CreateDatabricksAppAsync(
                    ownerId,
                    connection.WorkspaceUrl,
                    request.WorkspaceConnectionId,
                    requestedDatabricksAppName,
                    request.DatabricksAppDescription,
                    request.DatabricksAppResources,
                    userSafeUpstreamMessage);
                if (createResult.IsFailed)
                {
                    return Result.Fail<AppDto>(createResult.Errors);
                }

                CreatedDatabricksAppDto createdDatabricksApp = createResult.Value;
                createdDatabricksAppName = createdDatabricksApp.Name.Trim();
                databricksAppName = createdDatabricksAppName;
            }
            else
            {
                return Result.Fail<AppDto>(new BadRequestError("Unsupported databricksAppMode value."));
            }

            App app = new App
            {
                OwnerId = ownerId,
                AppName = request.AppName.Trim(),
                DatabricksAppName = databricksAppName,
                Description = request.Description,
                TenantId = tenantId,
                WorkspaceConnectionId = request.WorkspaceConnectionId,
                WorkspacePath = request.WorkspacePath,
                Version = 1,
                CreatedOn = DateTime.UtcNow,
                Theme = request.Theme,
                WorkflowDefinition = request.WorkflowDefinition,
                CustomModulesCode = CustomModulesTemplate.ResolveContent(request.CustomModulesCode)
            };

            try
            {
                _logger.LogInformation("Attempting to create app: {AppName}", app.AppName);
                await _repository.AddAsync(app);
            }
            catch (Exception ex)
            {
                if (request.DatabricksAppMode == DatabricksAppCreationMode.CreateNew && !string.IsNullOrWhiteSpace(createdDatabricksAppName))
                {
                    _logger.LogError(
                        ex,
                        "VDAB app insert failed after Databricks app was created. WorkspaceConnectionId={WorkspaceConnectionId}, OwnerId={OwnerId}, TenantId={TenantId}, DatabricksAppName={DatabricksAppName}",
                        request.WorkspaceConnectionId,
                        ownerId,
                        tenantId,
                        createdDatabricksAppName);

                    PartialDatabricksProvisionError partialError = new PartialDatabricksProvisionError(
                        "The VDAB app could not be saved after creating the Databricks app. Delete the Databricks app manually or run a follow-up cleanup task.",
                        createdDatabricksAppName,
                        request.WorkspaceConnectionId,
                        ex);

                    return Result.Fail<AppDto>(partialError);
                }

                _logger.LogError(ex, "Failed to create app: {AppName}", app.AppName);
                return Result.Fail<AppDto>(new ExceptionalError($"Failed to create app {app.AppName}.", ex));
            }

            if (app.PkId == 0)
            {
                IEnumerable<App> apps = await _repository.GetByOwnerIdAsync(app.OwnerId);
                App? foundApp = apps.FirstOrDefault(a => a.AppName == app.AppName && a.CreatedOn == app.CreatedOn);
                if (foundApp != null)
                {
                    app = foundApp;
                }
            }

            AppDto dto = ToDto(app);
            _logger.LogInformation("Successfully created app: {AppName} with ID: {AppId}", app.AppName, app.PkId);
            return Result.Ok(dto);
        }

        /// <inheritdoc/>
        public async Task<Result<AppDto>> CreateAppAsync(App app)
        {
            try
            {
                _logger.LogInformation("Attempting to create app: {AppName}", app.AppName);
                await _repository.AddAsync(app);

                // EF Core should populate app.PkId after SaveChangesAsync
                // If it's still 0, fetch by name as fallback (not ideal but works)
                if (app.PkId == 0)
                {
                    IEnumerable<App> apps = await _repository.GetByOwnerIdAsync(app.OwnerId);
                    App? foundApp = apps.FirstOrDefault(a => a.AppName == app.AppName && a.CreatedOn == app.CreatedOn);
                    if (foundApp != null)
                    {
                        app = foundApp;
                    }
                }

                AppDto dto = ToDto(app);

                _logger.LogInformation("Successfully created app: {AppName} with ID: {AppId}", app.AppName, app.PkId);
                return Result.Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create app: {AppName}", app.AppName);
                return Result.Fail<AppDto>(new ExceptionalError($"Failed to create app {app.AppName}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result> UpdateAppAsync(int appId, UpdateAppRequest request, Guid userId, Guid tenantId)
        {
            try
            {
                if (request == null)
                {
                    return Result.Fail(new BadRequestError("Request cannot be null."));
                }

                _logger.LogInformation("Attempting to update app: {AppId}", appId);
                App? existing = await _repository.GetByIdAsync(appId);
                if (existing == null)
                {
                    _logger.LogWarning("App with ID {AppId} not found for update", appId);
                    return Result.Fail(new BadRequestError($"App with ID {appId} not found"));
                }

                if (existing.TenantId.HasValue)
                {
                    Result lockResult = await _tenantLimitService.EnsureSubscriptionActiveAsync(existing.TenantId.Value);
                    if (lockResult.IsFailed)
                    {
                        return lockResult;
                    }
                }

                Result tenantGuardResult = _tenantResourceGuard.EnsureAppInTenant(existing, tenantId);
                if (tenantGuardResult.IsFailed)
                {
                    return Result.Fail(tenantGuardResult.Errors);
                }

                existing.AppName = request.AppName;
                existing.DatabricksAppName = request.DatabricksAppName;
                existing.Description = request.Description;
                existing.WorkspaceConnectionId = request.WorkspaceConnectionId;
                existing.WorkspacePath = request.WorkspacePath;
                existing.Version = request.Version;
                existing.LastPublishedAt = request.LastPublishedAt;
                existing.Theme = request.Theme;
                existing.WorkflowDefinition = request.WorkflowDefinition;
                if (request.CustomModulesCode != null)
                {
                    existing.CustomModulesCode = CustomModulesTemplate.ResolveContent(request.CustomModulesCode);
                }

                existing.ModifiedOn = DateTime.UtcNow;
                existing.ModifiedBy = userId;

                await _repository.UpdateAsync(existing);
                _logger.LogInformation("Successfully updated app: {AppId}", appId);
                return Result.Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update app: {AppId}", appId);
                return Result.Fail(new ExceptionalError($"Failed to update app {appId}.", ex));
            }
        }

        /// <inheritdoc/>
        public async Task<Result> DeleteAppAsync(int appId, Guid tenantId, Guid userId, bool isTenantAdmin)
        {
            try
            {
                _logger.LogInformation("Attempting to delete app by ID: {AppId}", appId);

                App? app = await _repository.GetByIdAsync(appId);
                if (app == null)
                {
                    _logger.LogWarning("App with ID {AppId} not found for deletion", appId);
                    return Result.Fail(new NotFoundError($"App with ID {appId} not found"));
                }

                Result tenantGuardResult = _tenantResourceGuard.EnsureCanDeleteApp(app, tenantId, userId, isTenantAdmin);
                if (tenantGuardResult.IsFailed)
                {
                    return Result.Fail(tenantGuardResult.Errors);
                }

                if (app.DeletedOn != null)
                {
                    _logger.LogWarning("App with ID {AppId} has already been deleted", appId);
                    return Result.Fail(new BadRequestError($"App with ID {appId} has already been deleted"));
                }

                await _repository.DeleteAsync(app);
                _logger.LogInformation("Successfully deleted app by ID: {AppId}", appId);
                return Result.Ok();
            }
            catch (Exception ex)
            {   
                _logger.LogError(ex, "Failed to delete app by ID: {AppId}", appId);
                return Result.Fail(new ExceptionalError($"Failed to delete app ID {appId}.", ex));
            }
        }

        private static AppDto ToDto(App app)
        {
            return new AppDto
            {
                Id = app.PkId,
                OwnerId = app.OwnerId,
                AppName = app.AppName,
                DatabricksAppName = app.DatabricksAppName,
                Description = app.Description,
                TenantId = app.TenantId,
                WorkspaceConnectionId = app.WorkspaceConnectionId,
                WorkspacePath = app.WorkspacePath,
                Version = app.Version,
                LastPublishedAt = app.LastPublishedAt,
                WorkflowDefinition = app.WorkflowDefinition,
                CustomModulesCode = app.CustomModulesCode,
                CreatedOn = app.CreatedOn,
                CreatedBy = app.CreatedBy,
                ModifiedOn = app.ModifiedOn,
                ModifiedBy = app.ModifiedBy,
                DeletedOn = app.DeletedOn,
                DeletedBy = app.DeletedBy,
                Theme = app.Theme
            };
        }
    }
}
