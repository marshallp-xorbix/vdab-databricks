using System.Transactions;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class AppImportExportService : IAppImportExportService
{
    private readonly IAppRepository _appRepository;
    private readonly IAppComponentRepository _componentRepository;
    private readonly IDatabricksConnectionRepository _connectionRepository;
    private readonly IUserTenantMembershipService _membershipService;
    private readonly ILogger<AppImportExportService> _logger;

    public AppImportExportService(
        IAppRepository appRepository,
        IAppComponentRepository componentRepository,
        IDatabricksConnectionRepository connectionRepository,
        IUserTenantMembershipService membershipService,
        ILogger<AppImportExportService> logger)
    {
        _appRepository = appRepository;
        _componentRepository = componentRepository;
        _connectionRepository = connectionRepository;
        _membershipService = membershipService;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<ExportBundleDto>> ExportAppsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Exporting all apps for tenant {TenantId}", tenantId);

            List<App> apps = (await _appRepository.GetByTenantIdAsync(tenantId)).ToList();
            Dictionary<int, string> connectionUrlsById = await BuildConnectionUrlMapAsync(tenantId);
            Dictionary<int, List<AppComponent>> componentsByApp =
                await BuildComponentMapAsync(apps.Select(app => app.PkId));

            List<AppExportDto> exported = apps
                .Select(app => BuildAppExport(app, componentsByApp, connectionUrlsById))
                .ToList();

            return Result.Ok(BuildBundle(exported));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export apps for tenant {TenantId}", tenantId);
            return Result.Fail<ExportBundleDto>(new ExceptionalError("Failed to export apps.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<ExportBundleDto>> ExportAppAsync(int appId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Exporting app {AppId} for tenant {TenantId}", appId, tenantId);

            App? app = await _appRepository.GetByIdAsync(appId);
            if (app == null || app.DeletedOn != null)
            {
                return Result.Fail<ExportBundleDto>(new NotFoundError($"App {appId} was not found."));
            }

            if (app.TenantId != tenantId)
            {
                return Result.Fail<ExportBundleDto>(new ForbiddenError("This app does not belong to your tenant."));
            }

            Dictionary<int, string> connectionUrlsById = await BuildConnectionUrlMapAsync(tenantId);
            Dictionary<int, List<AppComponent>> componentsByApp =
                await BuildComponentMapAsync([app.PkId]);
            AppExportDto exported = BuildAppExport(app, componentsByApp, connectionUrlsById);

            return Result.Ok(BuildBundle([exported]));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export app {AppId}", appId);
            return Result.Fail<ExportBundleDto>(new ExceptionalError("Failed to export app.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<ImportElementResultDto>> ImportAppAsync(ImportAppRequest request, Guid tenantId, CancellationToken cancellationToken = default)
    {
        if (request?.App == null || string.IsNullOrWhiteSpace(request.App.AppName))
        {
            return Result.Fail<ImportElementResultDto>(new BadRequestError("App name is required."));
        }

        if (request.WorkspaceConnectionId <= 0)
        {
            return Result.Fail<ImportElementResultDto>(new BadRequestError("A Databricks connection must be selected for the app."));
        }

        if (request.OwnerId == Guid.Empty)
        {
            return Result.Fail<ImportElementResultDto>(new BadRequestError("An owner must be selected for the app."));
        }

        try
        {
            DatabricksConnection? connection = await _connectionRepository.GetByIdAsync(request.WorkspaceConnectionId);
            if (connection == null || connection.DeletedOn != null)
            {
                return Result.Fail<ImportElementResultDto>(new NotFoundError("The selected Databricks connection was not found."));
            }

            if (connection.TenantId != tenantId)
            {
                return Result.Fail<ImportElementResultDto>(new ForbiddenError("The selected Databricks connection does not belong to your tenant."));
            }

            bool ownerBelongs = await _membershipService.UserBelongsToTenantAsync(request.OwnerId, tenantId, cancellationToken);
            if (!ownerBelongs)
            {
                return Result.Fail<ImportElementResultDto>(new BadRequestError("The selected owner is not a member of your tenant."));
            }

            IEnumerable<App> existingApps = await _appRepository.GetByTenantIdAsync(tenantId);
            HashSet<string> existingNames = existingApps
                .Select(a => a.AppName)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            string requestedName = request.App.AppName.Trim();
            string finalName = ImportNaming.ResolveUniqueName(requestedName, existingNames);
            bool renamed = !string.Equals(finalName, requestedName, StringComparison.Ordinal);

            App app = new App
            {
                OwnerId = request.OwnerId,
                TenantId = tenantId,
                WorkspaceConnectionId = request.WorkspaceConnectionId,
                AppName = finalName,
                DatabricksAppName = request.App.DatabricksAppName,
                Description = request.App.Description,
                WorkspacePath = request.App.WorkspacePath,
                Version = request.App.Version,
                Theme = request.App.Theme,
                WorkflowDefinition = request.App.WorkflowDefinition,
                CustomModulesCode = request.App.CustomModulesCode,
                CreatedOn = DateTime.UtcNow,
                CreatedBy = request.OwnerId
            };

            using (TransactionScope scope = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled))
            {
                await _appRepository.AddAsync(app);

                foreach (AppComponentExportDto component in request.App.Components)
                {
                    AppComponent entity = new AppComponent
                    {
                        AppId = app.PkId,
                        CodeName = component.CodeName,
                        Description = component.Description,
                        ComponentType = component.ComponentType,
                        ComponentVersion = component.ComponentVersion,
                        Properties = string.IsNullOrWhiteSpace(component.Properties) ? "{}" : component.Properties,
                        Bindings = component.Bindings,
                        Children = component.Children,
                        Layout = component.Layout,
                        CreatedOn = DateTime.UtcNow,
                        CreatedBy = request.OwnerId
                    };

                    await _componentRepository.AddAsync(entity);
                }

                scope.Complete();
            }

            _logger.LogInformation("Imported app {AppName} ({AppId}) into tenant {TenantId}", finalName, app.PkId, tenantId);

            return Result.Ok(new ImportElementResultDto
            {
                Name = finalName,
                NewId = app.PkId,
                Renamed = renamed
            });
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to import app {AppName} into tenant {TenantId}", request.App.AppName, tenantId);
            return Result.Fail<ImportElementResultDto>(new ExceptionalError("Failed to import app.", ex));
        }
    }

    private async Task<Dictionary<int, string>> BuildConnectionUrlMapAsync(Guid tenantId)
    {
        IEnumerable<DatabricksConnection> connections = await _connectionRepository.GetByTenantIdAsync(tenantId)
            ?? Enumerable.Empty<DatabricksConnection>();

        return connections.ToDictionary(connection => connection.PkId, connection => connection.WorkspaceUrl);
    }

    private async Task<Dictionary<int, List<AppComponent>>> BuildComponentMapAsync(IEnumerable<int> appIds)
    {
        IEnumerable<AppComponent> components = await _componentRepository.GetByAppIdsAsync(appIds);

        return components
            .Where(component => component.DeletedOn == null)
            .GroupBy(component => component.AppId)
            .ToDictionary(group => group.Key, group => group.ToList());
    }

    private static AppExportDto BuildAppExport(
        App app,
        IReadOnlyDictionary<int, List<AppComponent>> componentsByApp,
        Dictionary<int, string> connectionUrlsById)
    {
        connectionUrlsById.TryGetValue(app.WorkspaceConnectionId, out string? workspaceUrl);
        componentsByApp.TryGetValue(app.PkId, out List<AppComponent>? components);

        return new AppExportDto
        {
            AppName = app.AppName,
            DatabricksAppName = app.DatabricksAppName,
            Description = app.Description,
            WorkspacePath = app.WorkspacePath,
            Version = app.Version,
            Theme = app.Theme,
            WorkflowDefinition = app.WorkflowDefinition,
            CustomModulesCode = app.CustomModulesCode,
            WorkspaceUrl = workspaceUrl,
            Components = (components ?? [])
                .Select(c => new AppComponentExportDto
                {
                    CodeName = c.CodeName,
                    Description = c.Description,
                    ComponentType = c.ComponentType,
                    ComponentVersion = c.ComponentVersion,
                    Properties = c.Properties,
                    Bindings = c.Bindings,
                    Children = c.Children,
                    Layout = c.Layout
                })
                .ToList()
        };
    }

    private static ExportBundleDto BuildBundle(List<AppExportDto> apps) => new ExportBundleDto
    {
        SchemaVersion = 1,
        ExportedAt = DateTime.UtcNow,
        Type = ExportBundleTypes.Apps,
        Apps = apps
    };
}
