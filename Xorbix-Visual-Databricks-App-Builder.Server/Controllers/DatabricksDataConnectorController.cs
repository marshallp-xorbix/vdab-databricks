using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers
{
    [ApiController]
    [Authorize(Policy = AuthPolicies.RequireTenantMembership)]
    [Route("api/[controller]")]
    public class DatabricksDataConnectorController : AuthenticatedControllerBase
    {
        private readonly IDatabricksDataConnectorService _dataConnectorService;
        private readonly ILogger<DatabricksDataConnectorController> _logger;

        public DatabricksDataConnectorController(
            IDatabricksDataConnectorService dataConnectorService,
            ILogger<DatabricksDataConnectorController> logger)
        {
            _dataConnectorService = dataConnectorService;
            _logger = logger;
        }

        [HttpGet("tables")]
        public async Task<IActionResult> GetUnityCatalogTables([FromQuery] int workspaceConnectionId, [FromQuery] string? catalog = null, [FromQuery] string? schema = null)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Unity Catalog tables for connection: {workspaceConnectionId}, catalog: {catalog}, schema: {schema}, User: {UserId}", workspaceConnectionId, catalog, schema, userId);

            Result<List<UnityCatalogTable>> result = await _dataConnectorService.GetUnityCatalogTablesAsync(userId, tenantId, workspaceConnectionId, catalog, schema);

            return this.HandleFluentResult(result);
        }

        [HttpGet("catalogs")]
        public async Task<IActionResult> GetUnityCatalogCatalogs([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Unity Catalog catalogs for connection: {workspaceConnectionId}, User: {UserId}", workspaceConnectionId, userId);

            Result<List<string>> result = await _dataConnectorService.GetUnityCatalogCatalogsAsync(userId, tenantId, workspaceConnectionId);

            return this.HandleFluentResult(result);
        }

        [HttpGet("schemas")]
        public async Task<IActionResult> GetUnityCatalogSchemas([FromQuery] int workspaceConnectionId, [FromQuery] string catalog)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrEmpty(catalog))
            {
                return BadRequest("Catalog name is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Unity Catalog schemas for connection: {workspaceConnectionId}, catalog: {catalog}, User: {UserId}", workspaceConnectionId, catalog, userId);

            Result<List<string>> result = await _dataConnectorService.GetUnityCatalogSchemasAsync(userId, tenantId, workspaceConnectionId, catalog);

            return this.HandleFluentResult(result);
        }

        [HttpGet("volumes")]
        public async Task<IActionResult> GetUnityCatalogVolumes([FromQuery] int workspaceConnectionId, [FromQuery] string catalog, [FromQuery] string schema)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrEmpty(catalog))
            {
                return BadRequest("Catalog name is required");
            }

            if (string.IsNullOrEmpty(schema))
            {
                return BadRequest("Schema name is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Unity Catalog volumes for connection: {workspaceConnectionId}, catalog: {catalog}, schema: {schema}, User: {UserId}", workspaceConnectionId, catalog, schema, userId);

            Result<List<string>> result = await _dataConnectorService.GetUnityCatalogVolumesAsync(userId, tenantId, workspaceConnectionId, catalog, schema);

            return this.HandleFluentResult(result);
        }

        [HttpGet("jobs")]
        public async Task<IActionResult> GetJobs([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Databricks jobs for connection: {workspaceConnectionId}, User: {UserId}", workspaceConnectionId, userId);

            Result<List<DatabricksJob>> result = await _dataConnectorService.GetJobsAsync(userId, tenantId, workspaceConnectionId);

            return this.HandleFluentResult(result);
        }

        [HttpGet("sql-warehouses")]
        public async Task<IActionResult> GetSqlWarehouses([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting SQL warehouses for connection: {workspaceConnectionId}, User: {UserId}", workspaceConnectionId, userId);

            Result<List<DatabricksSqlWarehouse>> result = await _dataConnectorService.GetSqlWarehousesAsync(userId, tenantId, workspaceConnectionId);

            return this.HandleFluentResult(result);
        }

        [HttpGet("database-instances")]
        public async Task<IActionResult> GetDatabaseInstances([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Lakebase database instances for connection: {workspaceConnectionId}, User: {UserId}", workspaceConnectionId, userId);

            var result = await _dataConnectorService.GetDatabaseInstancesAsync(userId, tenantId, workspaceConnectionId);

            return this.HandleFluentResult(result);
        }

        [HttpGet("lakebase-app-resource-databases")]
        public async Task<IActionResult> GetLakebaseAppResourceDatabaseOptions([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Lakebase database instances for app resources, connection: {workspaceConnectionId}, User: {UserId}", workspaceConnectionId, userId);

            Result<List<LakebaseAppResourceDatabaseOption>> result = await _dataConnectorService.GetLakebaseAppResourceDatabaseOptionsAsync(userId, tenantId, workspaceConnectionId);

            return this.HandleFluentResult(result);
        }

        [HttpGet("lakebase-autoscaling")]
        public async Task<IActionResult> GetLakebaseAutoscalingSelector([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Lakebase autoscaling selector data for connection: {workspaceConnectionId}, User: {UserId}", workspaceConnectionId, userId);

            Result<LakebaseAutoscalingSelectorResponse> result = await _dataConnectorService.GetLakebaseAutoscalingSelectorAsync(userId, tenantId, workspaceConnectionId);

            return this.HandleFluentResult(result);
        }

        [HttpGet("lakebase-autoscaling-databases")]
        public async Task<IActionResult> GetLakebaseAutoscalingDatabases(
            [FromQuery] int workspaceConnectionId,
            [FromQuery] string projectId,
            [FromQuery] string branchId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrWhiteSpace(projectId))
            {
                return BadRequest("Project id is required");
            }

            if (string.IsNullOrWhiteSpace(branchId))
            {
                return BadRequest("Branch id is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation(
                "Getting Lakebase autoscaling databases for connection: {workspaceConnectionId}, project: {projectId}, branch: {branchId}, User: {UserId}",
                workspaceConnectionId,
                projectId,
                branchId,
                userId);

            Result<List<string>> result = await _dataConnectorService.GetLakebaseAutoscalingDatabasesAsync(
                userId,
                tenantId,
                workspaceConnectionId,
                projectId,
                branchId);

            return this.HandleFluentResult(result);
        }

        [HttpGet("lakebase-autoscaling-schemas")]
        public async Task<IActionResult> GetLakebaseAutoscalingSchemas(
            [FromQuery] int workspaceConnectionId,
            [FromQuery] string projectId,
            [FromQuery] string branchId,
            [FromQuery] string? databaseId,
            [FromQuery] string databaseName)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrWhiteSpace(projectId))
            {
                return BadRequest("Project id is required");
            }

            if (string.IsNullOrWhiteSpace(branchId))
            {
                return BadRequest("Branch id is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation(
                "Getting Lakebase autoscaling schemas for connection: {workspaceConnectionId}, project: {projectId}, branch: {branchId}, databaseId: {databaseId}, databaseName: {databaseName}, User: {UserId}",
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName,
                userId);

            Result<List<string>> result = await _dataConnectorService.GetLakebaseAutoscalingSchemasAsync(
                userId,
                tenantId,
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName);

            return this.HandleFluentResult(result);
        }

        [HttpGet("lakebase-autoscaling-tables")]
        public async Task<IActionResult> GetLakebaseAutoscalingTables(
            [FromQuery] int workspaceConnectionId,
            [FromQuery] string projectId,
            [FromQuery] string branchId,
            [FromQuery] string? databaseId,
            [FromQuery] string databaseName,
            [FromQuery] string schema)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrWhiteSpace(projectId))
            {
                return BadRequest("Project id is required");
            }

            if (string.IsNullOrWhiteSpace(branchId))
            {
                return BadRequest("Branch id is required");
            }

            if (string.IsNullOrWhiteSpace(schema))
            {
                return BadRequest("Schema name is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation(
                "Getting Lakebase autoscaling tables for connection: {workspaceConnectionId}, project: {projectId}, branch: {branchId}, databaseId: {databaseId}, databaseName: {databaseName}, schema: {schema}, User: {UserId}",
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName,
                schema,
                userId);

            Result<List<UnityCatalogTable>> result = await _dataConnectorService.GetLakebaseAutoscalingTablesAsync(
                userId,
                tenantId,
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName,
                schema);

            return this.HandleFluentResult(result);
        }

        [HttpGet("database-catalogs/{catalogName}")]
        public async Task<IActionResult> GetLakebaseDatabaseCatalogs([FromQuery] int workspaceConnectionId, [FromRoute] string catalogName)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrWhiteSpace(catalogName))
            {
                return BadRequest("Catalog name is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Lakebase database catalog for connection: {workspaceConnectionId}, catalogName: {catalogName}, User: {UserId}", workspaceConnectionId, catalogName, userId);

            Result<List<LakebaseDatabaseCatalog>> result = await _dataConnectorService.GetLakebaseDatabaseCatalogsAsync(userId, tenantId, workspaceConnectionId, catalogName);

            return this.HandleFluentResult(result);
        }

        [HttpGet("lakebase-autoscaling-table-details")]
        public async Task<IActionResult> GetLakebaseAutoscalingTableDetails(
            [FromQuery] int workspaceConnectionId,
            [FromQuery] string projectId,
            [FromQuery] string branchId,
            [FromQuery] string? databaseId,
            [FromQuery] string databaseName,
            [FromQuery] string schema,
            [FromQuery] string table)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrWhiteSpace(projectId))
            {
                return BadRequest("Project id is required");
            }

            if (string.IsNullOrWhiteSpace(branchId))
            {
                return BadRequest("Branch id is required");
            }

            if (string.IsNullOrWhiteSpace(databaseName))
            {
                return BadRequest("Database name is required");
            }

            if (string.IsNullOrWhiteSpace(schema))
            {
                return BadRequest("Schema name is required");
            }

            if (string.IsNullOrWhiteSpace(table))
            {
                return BadRequest("Table name is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            Result<UnityCatalogTableDetails> result = await _dataConnectorService.GetLakebaseAutoscalingTableDetailsAsync(
                userId,
                tenantId,
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName,
                schema,
                table);

            return this.HandleFluentResult(result);
        }

        [HttpGet("serving-endpoints")]
        public async Task<IActionResult> GetServingEndpoints([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            Result<List<DatabricksServingEndpointListItem>> result = await _dataConnectorService.GetServingEndpointsAsync(userId, tenantId, workspaceConnectionId);
            return this.HandleFluentResult(result);
        }

        [HttpGet("experiments")]
        public async Task<IActionResult> GetExperiments([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            Result<List<DatabricksExperimentListItem>> result = await _dataConnectorService.GetExperimentsAsync(userId, tenantId, workspaceConnectionId);
            return this.HandleFluentResult(result);
        }

        [HttpGet("genie-spaces")]
        public async Task<IActionResult> GetGenieSpaces([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            var result = await _dataConnectorService.GetGenieSpacesAsync(userId, tenantId, workspaceConnectionId);
            return this.HandleFluentResult(result);
        }

        [HttpGet("secret-scopes")]
        public async Task<IActionResult> GetSecretScopes([FromQuery] int workspaceConnectionId)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            Result<List<string>> result = await _dataConnectorService.GetSecretScopesAsync(userId, tenantId, workspaceConnectionId);
            return this.HandleFluentResult(result);
        }

        [HttpGet("secret-keys")]
        public async Task<IActionResult> GetSecretKeys([FromQuery] int workspaceConnectionId, [FromQuery] string secretScope)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrWhiteSpace(secretScope))
            {
                return BadRequest("Secret scope is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            var result = await _dataConnectorService.GetSecretKeysAsync(userId, tenantId, workspaceConnectionId, secretScope);
            return this.HandleFluentResult(result);
        }

        [HttpGet("table-details")]
        public async Task<IActionResult> GetUnityCatalogTableDetails([FromQuery] int workspaceConnectionId, [FromQuery] string catalog, [FromQuery] string schema, [FromQuery] string table)
        {
            if (workspaceConnectionId <= 0)
            {
                return BadRequest("Workspace connection ID is required");
            }

            if (string.IsNullOrEmpty(catalog))
            {
                return BadRequest("Catalog name is required");
            }

            if (string.IsNullOrEmpty(schema))
            {
                return BadRequest("Schema name is required");
            }

            if (string.IsNullOrEmpty(table))
            {
                return BadRequest("Table name is required");
            }

            ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
            if (authFailure is not null)
            {
                return authFailure;
            }

            _logger.LogInformation("Getting Unity Catalog table details for connection: {workspaceConnectionId}, catalog: {catalog}, schema: {schema}, table: {table}, User: {UserId}", workspaceConnectionId, catalog, schema, table, userId);

            Result<UnityCatalogTableDetails> result = await _dataConnectorService.GetUnityCatalogTableDetailsAsync(userId, tenantId, workspaceConnectionId, catalog, schema, table);

            return this.HandleFluentResult(result);
        }
    }
}
