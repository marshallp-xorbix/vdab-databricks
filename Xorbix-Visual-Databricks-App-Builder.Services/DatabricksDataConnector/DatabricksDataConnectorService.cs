using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Facade over domain-specific Databricks data connector services (Unity Catalog, jobs, warehouses, etc.).
/// </summary>
public class DatabricksDataConnectorService : IDatabricksDataConnectorService
{
    private readonly IDatabricksUnityCatalogService _unityCatalog;
    private readonly IDatabricksJobService _jobs;
    private readonly IDatabricksSqlWarehouseService _sqlWarehouses;
    private readonly IDatabricksLakebaseDatabaseService _lakebaseDatabase;
    private readonly IDatabricksServingEndpointService _servingEndpoints;
    private readonly IDatabricksExperimentService _experiments;
    private readonly IDatabricksGenieSpaceService _genieSpaces;
    private readonly IDatabricksSecretService _secrets;
    private readonly IDatabricksWorkspaceConnectionValidator _workspaceConnectionValidator;

    public DatabricksDataConnectorService(
        IDatabricksUnityCatalogService unityCatalog,
        IDatabricksJobService jobs,
        IDatabricksSqlWarehouseService sqlWarehouses,
        IDatabricksLakebaseDatabaseService lakebaseDatabase,
        IDatabricksServingEndpointService servingEndpoints,
        IDatabricksExperimentService experiments,
        IDatabricksGenieSpaceService genieSpaces,
        IDatabricksSecretService secrets,
        IDatabricksWorkspaceConnectionValidator workspaceConnectionValidator)
    {
        _unityCatalog = unityCatalog;
        _jobs = jobs;
        _sqlWarehouses = sqlWarehouses;
        _lakebaseDatabase = lakebaseDatabase;
        _servingEndpoints = servingEndpoints;
        _experiments = experiments;
        _genieSpaces = genieSpaces;
        _secrets = secrets;
        _workspaceConnectionValidator = workspaceConnectionValidator;
    }

    /// <inheritdoc/>
    public Task<Result<List<UnityCatalogTable>>> GetUnityCatalogTablesAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string? catalog = null, string? schema = null) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _unityCatalog.GetUnityCatalogTablesAsync(userId, workspaceConnectionId, catalog, schema));

    /// <inheritdoc/>
    public Task<Result<List<string>>> GetUnityCatalogCatalogsAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _unityCatalog.GetUnityCatalogCatalogsAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<string>>> GetUnityCatalogSchemasAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string catalog) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _unityCatalog.GetUnityCatalogSchemasAsync(userId, workspaceConnectionId, catalog));

    /// <inheritdoc/>
    public Task<Result<List<string>>> GetUnityCatalogVolumesAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string catalog, string schema) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _unityCatalog.GetUnityCatalogVolumesAsync(userId, workspaceConnectionId, catalog, schema));

    /// <inheritdoc/>
    public Task<Result<List<DatabricksJob>>> GetJobsAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _jobs.GetJobsAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<DatabricksSqlWarehouse>>> GetSqlWarehousesAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _sqlWarehouses.GetSqlWarehousesAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<LakebaseDatabaseInstance>>> GetDatabaseInstancesAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _lakebaseDatabase.GetDatabaseInstancesAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<LakebaseDatabaseCatalog>>> GetLakebaseDatabaseCatalogsAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string catalogName) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _lakebaseDatabase.GetLakebaseDatabaseCatalogsAsync(userId, workspaceConnectionId, catalogName));

    /// <inheritdoc/>
    public Task<Result<List<LakebaseAppResourceDatabaseOption>>> GetLakebaseAppResourceDatabaseOptionsAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _lakebaseDatabase.GetLakebaseAppResourceDatabaseOptionsAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<LakebaseAutoscalingSelectorResponse>> GetLakebaseAutoscalingSelectorAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _lakebaseDatabase.GetLakebaseAutoscalingSelectorAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<string>>> GetLakebaseAutoscalingDatabasesAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId,
        string projectId,
        string branchId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _lakebaseDatabase.GetLakebaseAutoscalingDatabasesAsync(
                userId,
                workspaceConnectionId,
                projectId,
                branchId));

    /// <inheritdoc/>
    public Task<Result<List<string>>> GetLakebaseAutoscalingSchemasAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _lakebaseDatabase.GetLakebaseAutoscalingSchemasAsync(
                userId,
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName));

    /// <inheritdoc/>
    public Task<Result<List<UnityCatalogTable>>> GetLakebaseAutoscalingTablesAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName,
        string schema) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _lakebaseDatabase.GetLakebaseAutoscalingTablesAsync(
                userId,
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName,
                schema));

    /// <inheritdoc/>
    public Task<Result<UnityCatalogTableDetails>> GetLakebaseAutoscalingTableDetailsAsync(
        Guid userId,
        Guid tenantId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName,
        string schema,
        string table) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _lakebaseDatabase.GetLakebaseAutoscalingTableDetailsAsync(
                userId,
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName,
                schema,
                table));

    /// <inheritdoc/>
    public Task<Result<UnityCatalogTableDetails>> GetUnityCatalogTableDetailsAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string catalog, string schema, string table) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _unityCatalog.GetUnityCatalogTableDetailsAsync(userId, workspaceConnectionId, catalog, schema, table));

    /// <inheritdoc/>
    public Task<Result<List<DatabricksServingEndpointListItem>>> GetServingEndpointsAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _servingEndpoints.GetServingEndpointsAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<DatabricksExperimentListItem>>> GetExperimentsAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _experiments.GetExperimentsAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<DatabricksGenieSpaceListItem>>> GetGenieSpacesAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _genieSpaces.GetGenieSpacesAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<string>>> GetSecretScopesAsync(Guid userId, Guid tenantId, int workspaceConnectionId) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _secrets.GetSecretScopesAsync(userId, workspaceConnectionId));

    /// <inheritdoc/>
    public Task<Result<List<string>>> GetSecretKeysAsync(Guid userId, Guid tenantId, int workspaceConnectionId, string scope) =>
        WithTenantValidationAsync(tenantId, workspaceConnectionId,
            () => _secrets.GetSecretKeysAsync(userId, workspaceConnectionId, scope));

    /// <summary>
    /// Validates that the workspace connection belongs to the tenant, then runs <paramref name="action"/>.
    /// Short-circuits with the validation errors when the connection is not valid for the tenant.
    /// </summary>
    private async Task<Result<T>> WithTenantValidationAsync<T>(
        Guid tenantId,
        int workspaceConnectionId,
        Func<Task<Result<T>>> action)
    {
        Result<DatabricksConnection> validationResult =
            await _workspaceConnectionValidator.ValidateWorkspaceConnectionForTenantAsync(tenantId, workspaceConnectionId);
        if (validationResult.IsFailed)
        {
            return Result.Fail<T>(validationResult.Errors);
        }

        return await action();
    }
}
