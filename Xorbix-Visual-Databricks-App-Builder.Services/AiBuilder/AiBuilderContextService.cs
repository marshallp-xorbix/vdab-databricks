using System.Text;
using FluentResults;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.App;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <inheritdoc/>
public class AiBuilderContextService : IAiBuilderContextService
{
    private readonly ILogger<AiBuilderContextService> _logger;
    private readonly IAppService _appService;
    private readonly ITenantService _tenantService;
    private readonly IDatabricksDataConnectorService _dataConnector;
    private readonly IDatabricksWorkspaceConnectionValidator _workspaceConnectionValidator;
    private readonly IMemoryCache _cache;

    public AiBuilderContextService(
        ILogger<AiBuilderContextService> logger,
        IAppService appService,
        ITenantService tenantService,
        IDatabricksDataConnectorService dataConnector,
        IDatabricksWorkspaceConnectionValidator workspaceConnectionValidator,
        IMemoryCache cache)
    {
        _logger = logger;
        _appService = appService;
        _tenantService = tenantService;
        _dataConnector = dataConnector;
        _workspaceConnectionValidator = workspaceConnectionValidator;
        _cache = cache;
    }

    /// <inheritdoc/>
    public async Task<Result<AiBuilderDatabricksContext>> BuildDatabricksContextAsync(
        int appId,
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        Result<AppDto?> appResult = await _appService.GetAppByIdAsync(appId, tenantId);
        if (appResult.IsFailed || appResult.Value is null)
            return Result.Fail<AiBuilderDatabricksContext>(new NotFoundError("App not found."));

        string appName = appResult.Value.AppName;
        Result<Tenant> tenantResult = await _tenantService.GetTenantAsync(tenantId, cancellationToken);
        string tenantName = tenantResult.IsSuccess ? tenantResult.Value.TenantName : string.Empty;

        int workspaceConnectionId = appResult.Value.WorkspaceConnectionId;
        if (workspaceConnectionId <= 0)
        {
            return Result.Ok(new AiBuilderDatabricksContext
            {
                WorkspaceConnectionId = 0,
                Context = string.Empty,
                AppName = appName,
                TenantName = tenantName,
            });
        }

        Result<DatabricksConnection> connectionResult =
            await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
        if (connectionResult.IsFailed)
            return Result.Fail<AiBuilderDatabricksContext>(connectionResult.Errors);

        string cacheKey = $"ai-builder-ctx:{tenantId}:{userId}:{workspaceConnectionId}";
        if (_cache.TryGetValue(cacheKey, out AiBuilderDatabricksContext? cachedContext) && cachedContext is not null)
        {
            return Result.Ok(new AiBuilderDatabricksContext
            {
                WorkspaceConnectionId = cachedContext.WorkspaceConnectionId,
                Context = cachedContext.Context,
                AppName = appName,
                TenantName = tenantName,
            });
        }

        StringBuilder sb = new();

        // Sequential awaits: downstream Databricks services resolve workspace connections through
        // repositories that share a single scoped DbContext, which is not safe for concurrent use.
        Result<List<UnityCatalogTable>> tablesResult =
            await _dataConnector.GetUnityCatalogTablesAsync(userId, tenantId, workspaceConnectionId);
        Result<List<DatabricksJob>> jobsResult =
            await _dataConnector.GetJobsAsync(userId, tenantId, workspaceConnectionId);
        Result<List<LakebaseDatabaseInstance>> lakebaseInstancesResult =
            await _dataConnector.GetDatabaseInstancesAsync(userId, tenantId, workspaceConnectionId);
        Result<LakebaseAutoscalingSelectorResponse> lakebaseAutoscalingResult =
            await _dataConnector.GetLakebaseAutoscalingSelectorAsync(userId, tenantId, workspaceConnectionId);

        if (tablesResult.IsFailed)
            _logger.LogWarning(
                "AI builder: GetUnityCatalogTablesAsync failed for connection {Id}: {Errors}",
                workspaceConnectionId,
                string.Join(", ", tablesResult.Errors.Select(e => e.Message)));
        else if (tablesResult.Value.Count > 0)
        {
            sb.Append("\n\nAVAILABLE UNITY CATALOG TABLES (workspaceConnectionId: ").Append(workspaceConnectionId).Append("):\n");
            foreach (UnityCatalogTable table in tablesResult.Value)
                sb.AppendLine($"  {table.FullName}  (catalog:{table.Catalog}, schema:{table.Schema}, table:{table.Table})");
        }

        if (jobsResult.IsFailed)
            _logger.LogWarning(
                "AI builder: GetJobsAsync failed for connection {Id}: {Errors}",
                workspaceConnectionId,
                string.Join(", ", jobsResult.Errors.Select(e => e.Message)));
        else if (jobsResult.Value.Count > 0)
        {
            sb.Append("\n\nAVAILABLE DATABRICKS JOBS (workspaceConnectionId: ").Append(workspaceConnectionId).Append("):\n");
            foreach (DatabricksJob job in jobsResult.Value)
                sb.AppendLine($"  jobId:{job.JobId}  jobName:{job.JobName}");
        }

        if (lakebaseInstancesResult.IsFailed)
            _logger.LogWarning(
                "AI builder: GetDatabaseInstancesAsync failed for connection {Id}: {Errors}",
                workspaceConnectionId,
                string.Join(", ", lakebaseInstancesResult.Errors.Select(e => e.Message)));
        else if (lakebaseInstancesResult.Value.Count > 0)
        {
            sb.Append("\n\nAVAILABLE LAKEBASE PROVISIONED INSTANCES (workspaceConnectionId: ").Append(workspaceConnectionId).Append("):\n");
            foreach (LakebaseDatabaseInstance instance in lakebaseInstancesResult.Value)
                sb.AppendLine($"  instanceName:{instance.Name}  database:{instance.DatabaseName}");
        }

        if (lakebaseAutoscalingResult.IsFailed)
            _logger.LogWarning(
                "AI builder: GetLakebaseAutoscalingSelectorAsync failed for connection {Id}: {Errors}",
                workspaceConnectionId,
                string.Join(", ", lakebaseAutoscalingResult.Errors.Select(e => e.Message)));
        else if (lakebaseAutoscalingResult.IsSuccess && lakebaseAutoscalingResult.Value.Projects.Count > 0)
        {
            sb.Append("\n\nAVAILABLE LAKEBASE AUTOSCALING ENDPOINTS (workspaceConnectionId: ").Append(workspaceConnectionId).Append("):\n");
            foreach (LakebaseAutoscalingProjectOption project in lakebaseAutoscalingResult.Value.Projects)
            {
                foreach (LakebaseAutoscalingBranchOption branch in project.Branches)
                {
                    foreach (LakebaseAutoscalingEndpointOption endpoint in branch.Endpoints)
                    {
                        string defaultMark = branch.IsDefault ? " [default]" : string.Empty;
                        sb.AppendLine(
                            $"  project:\"{project.ProjectName}\" projectId:{project.ProjectId}  branch:\"{branch.BranchName}\"{defaultMark} branchId:{branch.BranchId}  endpoint:\"{endpoint.EndpointName}\" endpointId:{endpoint.EndpointId}");
                    }
                }
            }
        }

        bool coreFailed = tablesResult.IsFailed || jobsResult.IsFailed;

        AiBuilderDatabricksContext result = new()
        {
            WorkspaceConnectionId = workspaceConnectionId,
            Context = sb.ToString(),
            AppName = appName,
            TenantName = tenantName,
        };
        TimeSpan cacheTtl = coreFailed ? TimeSpan.FromSeconds(30) : TimeSpan.FromMinutes(3);
        _cache.Set(cacheKey, result, cacheTtl);
        return Result.Ok(result);
    }
}
