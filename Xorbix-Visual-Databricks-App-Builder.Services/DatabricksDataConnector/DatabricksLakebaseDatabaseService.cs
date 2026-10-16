using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Npgsql;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksLakebaseDatabaseService : IDatabricksLakebaseDatabaseService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly IDatabricksWorkspaceConnectionResolver _workspaceResolver;
    private readonly ILogger<DatabricksLakebaseDatabaseService> _logger;

    public DatabricksLakebaseDatabaseService(
        IDatabricksApiService databricksApi,
        IDatabricksWorkspaceConnectionResolver workspaceResolver,
        ILogger<DatabricksLakebaseDatabaseService> logger)
    {
        _databricksApi = databricksApi;
        _workspaceResolver = workspaceResolver;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<List<LakebaseDatabaseInstance>>> GetDatabaseInstancesAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<LakebaseDatabaseInstance>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Lakebase database instances for workspace: {workspaceUrl}", workspaceUrl);

            return await GetDatabaseInstancesFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Lakebase database instances for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<LakebaseDatabaseInstance>>("Failed to retrieve Lakebase database instances");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<LakebaseDatabaseCatalog>>> GetLakebaseDatabaseCatalogsAsync(Guid userId, int workspaceConnectionId, string catalogName)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<LakebaseDatabaseCatalog>>();
            }

            if (string.IsNullOrWhiteSpace(catalogName))
            {
                return Result.Fail<List<LakebaseDatabaseCatalog>>("Catalog name is required");
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Lakebase database catalog for workspace: {workspaceUrl}, catalogName: {catalogName}", workspaceUrl, catalogName);

            return await GetDatabaseCatalogFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, catalogName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Lakebase database catalog for connection: {workspaceConnectionId}, catalogName: {catalogName}", workspaceConnectionId, catalogName);
            return Result.Fail<List<LakebaseDatabaseCatalog>>("Failed to retrieve Lakebase database catalog");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<LakebaseAppResourceDatabaseOption>>> GetLakebaseAppResourceDatabaseOptionsAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<LakebaseAppResourceDatabaseOption>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            Result<List<LakebaseDatabaseInstance>> instancesResult =
                await GetDatabaseInstancesFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl);
            if (instancesResult.IsFailed)
            {
                return Result.Fail<List<LakebaseAppResourceDatabaseOption>>(instancesResult.Errors);
            }

            List<LakebaseAppResourceDatabaseOption> options = new();
            foreach (LakebaseDatabaseInstance inst in instancesResult.Value)
            {
                string instanceName = inst.Name?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(instanceName))
                {
                    continue;
                }

                string? dbName = inst.DatabaseName?.Trim();
                if (string.IsNullOrWhiteSpace(dbName))
                {
                    Result<LakebaseDatabaseInstance> detailResult =
                        await GetDatabaseInstanceByNameFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, instanceName).ConfigureAwait(false);
                    if (detailResult.IsSuccess && !string.IsNullOrWhiteSpace(detailResult.Value.DatabaseName))
                    {
                        dbName = detailResult.Value.DatabaseName.Trim();
                    }
                }

                if (string.IsNullOrWhiteSpace(dbName))
                {
                    dbName = instanceName;
                    _logger.LogDebug(
                        "No database_name from Lakebase APIs for instance {instanceName}; using instance name as database_name fallback",
                        instanceName);
                }

                options.Add(new LakebaseAppResourceDatabaseOption
                {
                    InstanceName = instanceName,
                    DatabaseName = dbName,
                });
            }

            List<LakebaseAppResourceDatabaseOption> ordered = options
                .OrderBy(static o => o.InstanceName, StringComparer.OrdinalIgnoreCase)
                .ToList();

            _logger.LogInformation(
                "Built {count} Lakebase app-resource database option(s) from database instances API",
                ordered.Count);

            return Result.Ok(ordered);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing Lakebase database options for app resources: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<LakebaseAppResourceDatabaseOption>>("Failed to list Lakebase databases");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<LakebaseAutoscalingSelectorResponse>> GetLakebaseAutoscalingSelectorAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<LakebaseAutoscalingSelectorResponse>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Lakebase autoscaling selector data for workspace: {workspaceUrl}", workspaceUrl);
            return await GetLakebaseAutoscalingSelectorFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Lakebase autoscaling selector data for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<LakebaseAutoscalingSelectorResponse>("Failed to retrieve Lakebase autoscaling selector data");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<string>>> GetLakebaseAutoscalingDatabasesAsync(
        Guid userId,
        int workspaceConnectionId,
        string projectId,
        string branchId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<string>>();
            }

            Result<LakebaseAutoscalingBranchConnectionContext> branchConnectionResult =
                await ResolveLakebaseAutoscalingBranchConnectionAsync(
                    userId,
                    workspaceConnectionId,
                    workspaceUrlResult.ValueOrDefault,
                    projectId,
                    branchId);
            if (branchConnectionResult.IsFailed)
            {
                return Result.Fail<List<string>>(branchConnectionResult.Errors);
            }

            LakebaseAutoscalingConnectionContext connection = new()
            {
                ProjectId = projectId?.Trim() ?? string.Empty,
                BranchId = branchId?.Trim() ?? string.Empty,
                DatabaseName = "databricks_postgres",
                EndpointId = branchConnectionResult.Value.EndpointId,
                Host = branchConnectionResult.Value.Host,
                Username = branchConnectionResult.Value.Username,
                Password = branchConnectionResult.Value.Password,
            };

            return await ListDatabaseNamesAsync(connection);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error getting Lakebase autoscaling databases for connection: {workspaceConnectionId}, project: {projectId}, branch: {branchId}",
                workspaceConnectionId,
                projectId,
                branchId);
            return Result.Fail<List<string>>("Failed to retrieve Lakebase databases");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<string>>> GetLakebaseAutoscalingSchemasAsync(
        Guid userId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<string>>();
            }

            Result<LakebaseAutoscalingConnectionContext> connectionResult =
                await ResolveLakebaseAutoscalingConnectionAsync(
                    userId,
                    workspaceConnectionId,
                    workspaceUrlResult.ValueOrDefault,
                    projectId,
                    branchId,
                    databaseId,
                    databaseName);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<List<string>>(connectionResult.Errors);
            }

            return await ListSchemasAsync(connectionResult.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error getting Lakebase autoscaling schemas for connection: {workspaceConnectionId}, project: {projectId}, branch: {branchId}, databaseId: {databaseId}, databaseName: {databaseName}",
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName);
            return Result.Fail<List<string>>("Failed to retrieve Lakebase schemas");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<UnityCatalogTable>>> GetLakebaseAutoscalingTablesAsync(
        Guid userId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName,
        string schema)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<UnityCatalogTable>>();
            }

            Result<LakebaseAutoscalingConnectionContext> connectionResult =
                await ResolveLakebaseAutoscalingConnectionAsync(
                    userId,
                    workspaceConnectionId,
                    workspaceUrlResult.ValueOrDefault,
                    projectId,
                    branchId,
                    databaseId,
                    databaseName);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<List<UnityCatalogTable>>(connectionResult.Errors);
            }

            return await ListTablesAsync(connectionResult.Value, schema);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error getting Lakebase autoscaling tables for connection: {workspaceConnectionId}, project: {projectId}, branch: {branchId}, databaseId: {databaseId}, databaseName: {databaseName}, schema: {schema}",
                workspaceConnectionId,
                projectId,
                branchId,
                databaseId,
                databaseName,
                schema);
            return Result.Fail<List<UnityCatalogTable>>("Failed to retrieve Lakebase tables");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UnityCatalogTableDetails>> GetLakebaseAutoscalingTableDetailsAsync(
        Guid userId,
        int workspaceConnectionId,
        string projectId,
        string branchId,
        string? databaseId,
        string databaseName,
        string schema,
        string table)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<UnityCatalogTableDetails>();
            }

            Result<LakebaseAutoscalingConnectionContext> connectionResult =
                await ResolveLakebaseAutoscalingConnectionAsync(
                    userId,
                    workspaceConnectionId,
                    workspaceUrlResult.ValueOrDefault,
                    projectId,
                    branchId,
                    databaseId,
                    databaseName);
            if (connectionResult.IsFailed)
            {
                return Result.Fail<UnityCatalogTableDetails>(connectionResult.Errors);
            }

            return await GetLakebaseTableDetailsAsync(connectionResult.Value, schema, table);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error getting Lakebase autoscaling table details for connection: {workspaceConnectionId}, project: {projectId}, branch: {branchId}, databaseName: {databaseName}, schema: {schema}, table: {table}",
                workspaceConnectionId,
                projectId,
                branchId,
                databaseName,
                schema,
                table);
            return Result.Fail<UnityCatalogTableDetails>("Failed to retrieve Lakebase table details");
        }
    }

    private async Task<Result<List<string>>> ListSchemasAsync(
        LakebaseAutoscalingConnectionContext connection)
    {
        const string sql = """
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name <> 'information_schema'
              AND schema_name <> 'pgrst'
              AND schema_name NOT LIKE 'pg_%'
            ORDER BY schema_name;
            """;

        try
        {
            await using NpgsqlConnection dbConnection = await OpenLakebaseConnectionAsync(connection);
            await using NpgsqlCommand command = new(sql, dbConnection)
            {
                CommandTimeout = 30,
            };

            List<string> schemas = [];
            await using NpgsqlDataReader reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                string? schemaName = reader.IsDBNull(0) ? null : reader.GetString(0);
                if (!string.IsNullOrWhiteSpace(schemaName))
                {
                    schemas.Add(schemaName.Trim());
                }
            }

            return Result.Ok(schemas);
        }
        catch (NpgsqlException ex)
        {
            _logger.LogWarning(
                ex,
                "Lakebase schema discovery failed for database {DatabaseName} on host {Host}",
                connection.DatabaseName,
                connection.Host);
            return Result.Fail<List<string>>(
                new UpstreamDependencyError(
                    BuildLakebaseMetadataFailureMessage(
                        "schemas",
                        connection.DatabaseName,
                        ex)));
        }
    }

    private async Task<Result<List<UnityCatalogTable>>> ListTablesAsync(
        LakebaseAutoscalingConnectionContext connection,
        string schema)
    {
        string schemaName = schema?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(schemaName))
        {
            return Result.Fail<List<UnityCatalogTable>>("Schema name is required");
        }

        const string sql = """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = @schema
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
            """;

        try
        {
            await using NpgsqlConnection dbConnection = await OpenLakebaseConnectionAsync(connection);
            await using NpgsqlCommand command = new(sql, dbConnection)
            {
                CommandTimeout = 30,
            };
            command.Parameters.AddWithValue("schema", schemaName);

            List<UnityCatalogTable> tables = [];
            await using NpgsqlDataReader reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                string? tableName = reader.IsDBNull(0) ? null : reader.GetString(0);
                if (string.IsNullOrWhiteSpace(tableName))
                {
                    continue;
                }

                string trimmedTableName = tableName.Trim();
                tables.Add(new UnityCatalogTable
                {
                    Catalog = connection.DatabaseName,
                    Schema = schemaName,
                    Table = trimmedTableName,
                    FullName = $"{connection.DatabaseName}.{schemaName}.{trimmedTableName}",
                });
            }

            return Result.Ok(tables);
        }
        catch (NpgsqlException ex)
        {
            _logger.LogWarning(
                ex,
                "Lakebase table discovery failed for database {DatabaseName}, schema {SchemaName}, host {Host}",
                connection.DatabaseName,
                schemaName,
                connection.Host);
            return Result.Fail<List<UnityCatalogTable>>(
                new UpstreamDependencyError(
                    BuildLakebaseMetadataFailureMessage(
                        $"tables in schema '{schemaName}'",
                        connection.DatabaseName,
                        ex)));
        }
    }

    private async Task<Result<UnityCatalogTableDetails>> GetLakebaseTableDetailsAsync(
        LakebaseAutoscalingConnectionContext connection,
        string schema,
        string table)
    {
        string schemaName = schema?.Trim() ?? string.Empty;
        string tableName = table?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(schemaName) || string.IsNullOrWhiteSpace(tableName))
        {
            return Result.Fail<UnityCatalogTableDetails>("Schema and table names are required");
        }

        const string sql = """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = @schema
              AND table_name = @table
            ORDER BY ordinal_position;
            """;

        try
        {
            await using NpgsqlConnection dbConnection = await OpenLakebaseConnectionAsync(connection);
            await using NpgsqlCommand command = new(sql, dbConnection)
            {
                CommandTimeout = 30,
            };
            command.Parameters.AddWithValue("schema", schemaName);
            command.Parameters.AddWithValue("table", tableName);

            List<UnityCatalogColumn> columns = [];
            await using NpgsqlDataReader reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                string? columnName = reader.IsDBNull(0) ? null : reader.GetString(0);
                string? columnType = reader.IsDBNull(1) ? null : reader.GetString(1);
                string? isNullable = reader.IsDBNull(2) ? null : reader.GetString(2);
                if (string.IsNullOrWhiteSpace(columnName))
                {
                    continue;
                }

                columns.Add(new UnityCatalogColumn
                {
                    Name = columnName.Trim(),
                    Type = columnType?.Trim(),
                    Nullable = string.Equals(isNullable, "YES", StringComparison.OrdinalIgnoreCase),
                    Comment = null,
                });
            }

            UnityCatalogTableDetails details = new()
            {
                CatalogName = connection.DatabaseName,
                SchemaName = schemaName,
                Name = tableName,
                FullName = $"{connection.DatabaseName}.{schemaName}.{tableName}",
                Columns = columns,
            };
            return Result.Ok(details);
        }
        catch (NpgsqlException ex)
        {
            _logger.LogWarning(
                ex,
                "Lakebase table detail discovery failed for database {DatabaseName}, schema {SchemaName}, table {TableName}, host {Host}",
                connection.DatabaseName,
                schemaName,
                tableName,
                connection.Host);
            return Result.Fail<UnityCatalogTableDetails>(
                new UpstreamDependencyError(
                    BuildLakebaseMetadataFailureMessage(
                        $"columns for table '{schemaName}.{tableName}'",
                        connection.DatabaseName,
                        ex)));
        }
    }

    private async Task<NpgsqlConnection> OpenLakebaseConnectionAsync(
        LakebaseAutoscalingConnectionContext connection)
    {
        NpgsqlConnectionStringBuilder builder = new()
        {
            Host = connection.Host,
            Database = connection.DatabaseName,
            Username = connection.Username,
            Password = connection.Password,
            Port = 5432,
            SslMode = SslMode.Require,
            Timeout = 30,
            CommandTimeout = 30,
        };

        NpgsqlConnection dbConnection = new(builder.ConnectionString);
        await dbConnection.OpenAsync();
        return dbConnection;
    }

    private async Task<Result<LakebaseAutoscalingConnectionContext>>
        ResolveLakebaseAutoscalingConnectionAsync(
            Guid userId,
            int workspaceConnectionId,
            string workspaceUrl,
            string projectId,
            string branchId,
            string? databaseId,
            string databaseName)
    {
        string trimmedProjectId = projectId?.Trim() ?? string.Empty;
        string trimmedBranchId = branchId?.Trim() ?? string.Empty;
        string trimmedDatabaseId = databaseId?.Trim() ?? string.Empty;
        string trimmedDatabaseName = databaseName?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(trimmedProjectId))
        {
            return Result.Fail<LakebaseAutoscalingConnectionContext>("Project id is required");
        }

        if (string.IsNullOrWhiteSpace(trimmedBranchId))
        {
            return Result.Fail<LakebaseAutoscalingConnectionContext>("Branch id is required");
        }

        string logicalDatabaseName = trimmedDatabaseName;
        if (string.IsNullOrWhiteSpace(logicalDatabaseName)
            || logicalDatabaseName.StartsWith("db-", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(trimmedDatabaseId))
            {
                return Result.Fail<LakebaseAutoscalingConnectionContext>("Database name is required");
            }

            Result<List<LakebaseAutoscalingEndpointOption>> branchOptionsResult =
                await GetMergedBranchEndpointOptionsAsync(
                    userId,
                    workspaceConnectionId,
                    workspaceUrl,
                    trimmedProjectId,
                    trimmedBranchId);
            if (branchOptionsResult.IsFailed)
            {
                return Result.Fail<LakebaseAutoscalingConnectionContext>(branchOptionsResult.Errors);
            }

            LakebaseAutoscalingEndpointOption? selectedOption = ResolveSelectedDatabaseOption(
                branchOptionsResult.Value,
                trimmedDatabaseId,
                trimmedDatabaseName);
            if (selectedOption == null)
            {
                string requestedDatabaseLabel = !string.IsNullOrWhiteSpace(trimmedDatabaseName)
                    ? trimmedDatabaseName
                    : trimmedDatabaseId;
                return Result.Fail<LakebaseAutoscalingConnectionContext>(
                    new NotFoundError(
                        $"The selected Lakebase database '{requestedDatabaseLabel}' could not be resolved on the chosen branch."));
            }

            logicalDatabaseName = ResolveLogicalDatabaseName(selectedOption, trimmedDatabaseName);
            if (string.IsNullOrWhiteSpace(logicalDatabaseName))
            {
                return Result.Fail<LakebaseAutoscalingConnectionContext>(
                    new UpstreamDependencyError(
                        "The selected Lakebase database does not expose a logical database name, so schemas and tables cannot be read yet."));
            }
        }

        Result<LakebaseAutoscalingBranchConnectionContext> branchConnectionResult =
            await ResolveLakebaseAutoscalingBranchConnectionAsync(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                trimmedProjectId,
                trimmedBranchId);
        if (branchConnectionResult.IsFailed)
        {
            return Result.Fail<LakebaseAutoscalingConnectionContext>(branchConnectionResult.Errors);
        }

        return Result.Ok(new LakebaseAutoscalingConnectionContext
        {
            ProjectId = trimmedProjectId,
            BranchId = trimmedBranchId,
            DatabaseId = trimmedDatabaseId,
            DatabaseName = logicalDatabaseName,
            EndpointId = branchConnectionResult.Value.EndpointId,
            Host = branchConnectionResult.Value.Host,
            Username = branchConnectionResult.Value.Username,
            Password = branchConnectionResult.Value.Password,
        });
    }

    private async Task<Result<List<LakebaseAutoscalingEndpointOption>>>
        GetMergedBranchEndpointOptionsAsync(
            Guid userId,
            int workspaceConnectionId,
            string workspaceUrl,
            string projectId,
            string branchId)
    {
        List<LakebaseAutoscalingEndpointOption> databaseResources =
            await TryLoadBranchDatabaseResourceOptionsAsync(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                projectId,
                projectId,
                branchId,
                branchId);
        Result<List<LakebaseAutoscalingEndpointOption>> endpointsResult =
            await GetEndpointOptionsAsync(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                projectId,
                projectId,
                branchId,
                branchId);
        if (endpointsResult.IsFailed)
        {
            return Result.Fail<List<LakebaseAutoscalingEndpointOption>>(endpointsResult.Errors);
        }

        List<LakebaseAutoscalingEndpointOption> mergedEndpoints = MergeLakebaseEndpointOptions(
            databaseResources,
            endpointsResult.Value);
        await EnrichLakebaseLogicalNamesFromDetailGetsAsync(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            projectId,
            branchId,
            mergedEndpoints);
        return Result.Ok(mergedEndpoints);
    }

    private async Task<Result<LakebaseAutoscalingBranchConnectionContext>>
        ResolveLakebaseAutoscalingBranchConnectionAsync(
            Guid userId,
            int workspaceConnectionId,
            string workspaceUrl,
            string projectId,
            string branchId)
    {
        Result<List<LakebaseAutoscalingEndpointOption>> endpointsResult =
            await GetEndpointOptionsAsync(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                projectId,
                projectId,
                branchId,
                branchId);
        if (endpointsResult.IsFailed)
        {
            return Result.Fail<LakebaseAutoscalingBranchConnectionContext>(endpointsResult.Errors);
        }

        string connectionEndpointId = ResolveBranchConnectionEndpointId(endpointsResult.Value);
        if (string.IsNullOrWhiteSpace(connectionEndpointId))
        {
            return Result.Fail<LakebaseAutoscalingBranchConnectionContext>(
                new UpstreamDependencyError(
                    $"Could not resolve a compute endpoint for Lakebase branch '{branchId}'."));
        }

        LakebaseAutoscalingEndpointOption? branchEndpoint = endpointsResult.Value.FirstOrDefault(
            option =>
                option.EndpointId.Trim().Equals(connectionEndpointId, StringComparison.OrdinalIgnoreCase)
                || option.ConnectionEndpointId.Trim().Equals(connectionEndpointId, StringComparison.OrdinalIgnoreCase));
        string host = branchEndpoint?.ConnectionHost?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(host))
        {
            Result<string> hostResult = await GetLakebaseEndpointHostAsync(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                projectId,
                branchId,
                connectionEndpointId);
            if (hostResult.IsFailed)
            {
                return Result.Fail<LakebaseAutoscalingBranchConnectionContext>(hostResult.Errors);
            }

            host = hostResult.ValueOrDefault;
        }

        Result<string> usernameResult = await GetCurrentLakebaseUsernameAsync(userId, workspaceConnectionId, workspaceUrl);
        if (usernameResult.IsFailed)
        {
            return Result.Fail<LakebaseAutoscalingBranchConnectionContext>(usernameResult.Errors);
        }

        string endpointResourceName =
            $"projects/{projectId.Trim()}/branches/{branchId.Trim()}/endpoints/{connectionEndpointId}";
        Result<string> passwordResult = await GenerateLakebaseDatabaseCredentialAsync(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            endpointResourceName);
        if (passwordResult.IsFailed)
        {
            return Result.Fail<LakebaseAutoscalingBranchConnectionContext>(passwordResult.Errors);
        }

        return Result.Ok(new LakebaseAutoscalingBranchConnectionContext
        {
            EndpointId = connectionEndpointId,
            Host = host,
            Username = usernameResult.ValueOrDefault,
            Password = passwordResult.ValueOrDefault,
        });
    }

    private static string ResolveBranchConnectionEndpointId(
        List<LakebaseAutoscalingEndpointOption> options)
    {
        LakebaseAutoscalingEndpointOption? direct = options.FirstOrDefault(
            static option =>
                option.EndpointId.Trim().StartsWith("ep-", StringComparison.OrdinalIgnoreCase)
                && option.EndpointType.Equals(
                    "ENDPOINT_TYPE_READ_WRITE",
                    StringComparison.OrdinalIgnoreCase));
        if (direct != null)
        {
            return direct.EndpointId.Trim();
        }

        LakebaseAutoscalingEndpointOption? firstCompute = options.FirstOrDefault(
            static option => option.EndpointId.Trim().StartsWith("ep-", StringComparison.OrdinalIgnoreCase));
        return firstCompute?.EndpointId?.Trim() ?? string.Empty;
    }

    private static LakebaseAutoscalingEndpointOption? ResolveSelectedDatabaseOption(
        List<LakebaseAutoscalingEndpointOption> options,
        string databaseId,
        string databaseName)
    {
        LakebaseAutoscalingEndpointOption? selected = options.FirstOrDefault(
            option =>
                Matches(option.AppsDatabaseResourceId, databaseId)
                || Matches(option.EndpointId, databaseId)
                || Matches(option.ConnectionEndpointId, databaseId));
        if (selected != null)
        {
            return selected;
        }

        if (!string.IsNullOrWhiteSpace(databaseName))
        {
            selected = options.FirstOrDefault(
                option => Matches(option.PostgresDatabaseName, databaseName));
        }

        return selected;
    }

    private static string ResolveLogicalDatabaseName(
        LakebaseAutoscalingEndpointOption option,
        string requestedDatabaseName)
    {
        string fromOption = option.PostgresDatabaseName?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(fromOption)
            && !fromOption.StartsWith("db-", StringComparison.OrdinalIgnoreCase))
        {
            return fromOption;
        }

        string requested = requestedDatabaseName?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(requested)
            && !requested.StartsWith("db-", StringComparison.OrdinalIgnoreCase))
        {
            return requested;
        }

        return string.Empty;
    }

    private static string ResolveConnectionEndpointId(
        LakebaseAutoscalingEndpointOption selectedOption,
        List<LakebaseAutoscalingEndpointOption> options)
    {
        string direct = selectedOption.ConnectionEndpointId?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(direct))
        {
            return direct;
        }

        if (selectedOption.EndpointId.StartsWith("ep-", StringComparison.OrdinalIgnoreCase))
        {
            return selectedOption.EndpointId.Trim();
        }

        LakebaseAutoscalingEndpointOption? branchPrimary = options.FirstOrDefault(
            option =>
                option.EndpointType.Equals(
                    "ENDPOINT_TYPE_READ_WRITE",
                    StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(option.ConnectionEndpointId));
        if (branchPrimary != null)
        {
            return branchPrimary.ConnectionEndpointId.Trim();
        }

        LakebaseAutoscalingEndpointOption? anyEndpoint = options.FirstOrDefault(
            option => !string.IsNullOrWhiteSpace(option.ConnectionEndpointId));
        return anyEndpoint?.ConnectionEndpointId?.Trim() ?? string.Empty;
    }

    private async Task<Result<string>> GetLakebaseEndpointHostAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string projectId,
        string branchId,
        string endpointId)
    {
        string endpointUrl =
            $"/api/2.0/postgres/projects/{Uri.EscapeDataString(projectId)}/branches/{Uri.EscapeDataString(branchId)}/endpoints/{Uri.EscapeDataString(endpointId)}";
        Result<JsonElement> endpointResult =
            await _databricksApi.GetAsync<JsonElement>(userId, workspaceConnectionId, workspaceUrl, endpointUrl);
        if (endpointResult.IsFailed)
        {
            return Result.Fail<string>(endpointResult.Errors);
        }

        string host =
            GetStringByPath(endpointResult.Value, "status", "hosts", "host")?.Trim()
            ?? string.Empty;
        if (string.IsNullOrWhiteSpace(host))
        {
            return Result.Fail<string>(
                new UpstreamDependencyError(
                    $"Databricks returned endpoint '{endpointId}' without a usable host."));
        }

        return Result.Ok(host);
    }

    private async Task<Result<string>> GetCurrentLakebaseUsernameAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl)
    {
        Result<DatabricksCurrentUserResponse> currentUserResult =
            await _databricksApi.GetAsync<DatabricksCurrentUserResponse>(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                "/api/2.0/preview/scim/v2/Me");
        if (currentUserResult.IsFailed)
        {
            return Result.Fail<string>(currentUserResult.Errors);
        }

        DatabricksCurrentUserResponse? currentUser = currentUserResult.ValueOrDefault;
        if (currentUser == null)
        {
            return Result.Fail<string>(
                new UpstreamDependencyError(
                    "Databricks returned an empty current-user response."));
        }

        string? username = currentUser.UserName?.Trim();
        if (string.IsNullOrWhiteSpace(username))
        {
            username = currentUser.Emails?
                .FirstOrDefault(email => !string.IsNullOrWhiteSpace(email.Value))
                ?.Value?
                .Trim();
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            return Result.Fail<string>(
                new UpstreamDependencyError(
                    "Databricks did not return a workspace username for the current identity."));
        }

        return Result.Ok(username);
    }

    private async Task<Result<string>> GenerateLakebaseDatabaseCredentialAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string endpointResourceName)
    {
        Result<DatabricksDatabaseCredentialResponse> credentialResult =
            await _databricksApi.PostAsync<DatabricksDatabaseCredentialResponse>(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                "/api/2.0/postgres/credentials",
                new
                {
                    endpoint = endpointResourceName,
                });
        if (credentialResult.IsFailed)
        {
            return Result.Fail<string>(credentialResult.Errors);
        }

        string token = credentialResult.ValueOrDefault?.Token?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(token))
        {
            return Result.Fail<string>(
                new UpstreamDependencyError(
                    "Databricks returned an empty Lakebase database credential."));
        }

        return Result.Ok(token);
    }

    private static bool Matches(string? left, string right) =>
        !string.IsNullOrWhiteSpace(left)
        && left.Trim().Equals(right, StringComparison.OrdinalIgnoreCase);

    private static string BuildLakebaseMetadataFailureMessage(
        string target,
        string databaseName,
        NpgsqlException ex)
    {
        string detail = ex.Message.Trim();
        if (string.IsNullOrWhiteSpace(detail))
        {
            return $"Failed to read {target} from Lakebase database '{databaseName}'.";
        }

        return $"Failed to read {target} from Lakebase database '{databaseName}'. {detail}";
    }

    private async Task<Result<List<LakebaseDatabaseInstance>>> GetDatabaseInstancesFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl)
    {
        try
        {
            List<LakebaseDatabaseInstance> instances = new();
            string? nextPageToken = null;

            do
            {
                string apiUrl = DatabricksApiRoutes.DatabaseInstancesPath;
                if (!string.IsNullOrWhiteSpace(nextPageToken))
                {
                    apiUrl = $"{apiUrl}?page_token={Uri.EscapeDataString(nextPageToken)}";
                }

                _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

                Result<DatabricksDatabaseInstancesResponse> apiResponseResult =
                    await _databricksApi.GetAsync<DatabricksDatabaseInstancesResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
                if (apiResponseResult.IsFailed)
                {
                    return Result.Fail<List<LakebaseDatabaseInstance>>(apiResponseResult.Errors);
                }

                DatabricksDatabaseInstancesResponse? apiResponse = apiResponseResult.ValueOrDefault;
                if (apiResponse?.DatabaseInstances != null)
                {
                    instances.AddRange(apiResponse.DatabaseInstances
                        .Where(i => !string.IsNullOrWhiteSpace(i.Name))
                        .Select(i => new LakebaseDatabaseInstance
                        {
                            Name = i.Name,
                            ReadWriteDns = i.ReadWriteDns,
                            DatabaseName = i.DatabaseName,
                        }));
                }

                nextPageToken = apiResponse?.NextPageToken;
            }
            while (!string.IsNullOrWhiteSpace(nextPageToken));

            _logger.LogInformation("Retrieved {count} Lakebase database instances", instances.Count);
            return Result.Ok(instances);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks database instances API");
            return Result.Fail<List<LakebaseDatabaseInstance>>("Failed to communicate with Databricks API");
        }
    }

    private async Task<Result<LakebaseAutoscalingSelectorResponse>> GetLakebaseAutoscalingSelectorFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl)
    {
        Result<List<JsonElement>> projectsResult = await GetPagedCollectionAsync(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            "/api/2.0/postgres/projects",
            "projects");
        if (projectsResult.IsFailed)
        {
            return Result.Fail<LakebaseAutoscalingSelectorResponse>(projectsResult.Errors);
        }

        List<LakebaseAutoscalingProjectOption> projects = [];
        foreach (JsonElement projectElement in projectsResult.Value)
        {
            string? projectName = GetString(projectElement, "name");
            if (string.IsNullOrWhiteSpace(projectName))
            {
                _logger.LogWarning("Skipping Postgres project without a valid name");
                continue;
            }

            string projectId = FirstNonEmpty(
                GetResourceId(projectName),
                GetString(projectElement, "project_id"),
                GetNestedString(projectElement, "spec", "project_id"),
                GetString(projectElement, "id"));
            if (string.IsNullOrWhiteSpace(projectId))
            {
                _logger.LogWarning("Skipping Postgres project with unparsable name: {projectName}", projectName);
                continue;
            }

            string displayName = ResolveLakebaseProjectDisplayName(
                projectElement,
                projectName,
                projectId);

            Result<List<LakebaseAutoscalingBranchOption>> branchesResult =
                await GetBranchOptionsAsync(userId, workspaceConnectionId, workspaceUrl, projectId, displayName);
            if (branchesResult.IsFailed)
            {
                return Result.Fail<LakebaseAutoscalingSelectorResponse>(branchesResult.Errors);
            }

            projects.Add(new LakebaseAutoscalingProjectOption
            {
                ProjectName = projectName,
                ProjectId = projectId,
                DisplayName = displayName,
                Branches = branchesResult.Value,
            });
        }

        LakebaseAutoscalingSelectorResponse response = new()
        {
            Projects = projects
                .OrderBy(static p => p.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(static p => p.ProjectId, StringComparer.OrdinalIgnoreCase)
                .ToList(),
        };

        _logger.LogInformation("Built Lakebase autoscaling selector data with {projectCount} project(s)", response.Projects.Count);
        return Result.Ok(response);
    }

    private async Task<Result<List<LakebaseAutoscalingBranchOption>>> GetBranchOptionsAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string projectId,
        string projectDisplayName)
    {
        string listBranchesEndpoint = $"/api/2.0/postgres/projects/{Uri.EscapeDataString(projectId)}/branches";
        Result<List<JsonElement>> branchesResult = await GetPagedCollectionAsync(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            listBranchesEndpoint,
            "branches");
        if (branchesResult.IsFailed)
        {
            return Result.Fail<List<LakebaseAutoscalingBranchOption>>(branchesResult.Errors);
        }

        List<LakebaseAutoscalingBranchOption> branches = [];
        foreach (JsonElement branchElement in branchesResult.Value)
        {
            string? branchName = GetString(branchElement, "name");
            if (string.IsNullOrWhiteSpace(branchName))
            {
                _logger.LogWarning("Skipping branch without a valid name under project {projectId}", projectId);
                continue;
            }

            string branchId = FirstNonEmpty(
                GetResourceId(branchName),
                GetString(branchElement, "branch_id"),
                GetNestedString(branchElement, "spec", "branch_id"),
                GetString(branchElement, "id"));
            if (string.IsNullOrWhiteSpace(branchId))
            {
                _logger.LogWarning("Skipping branch with unparsable name {branchName} under project {projectId}", branchName, projectId);
                continue;
            }

            bool isDefault =
                GetBool(branchElement, "default")
                ?? GetNestedBool(branchElement, "status", "default")
                ?? false;

            List<LakebaseAutoscalingEndpointOption> fromDatabases =
                await TryLoadBranchDatabaseResourceOptionsAsync(
                    userId,
                    workspaceConnectionId,
                    workspaceUrl,
                    projectId,
                    projectDisplayName,
                    branchName,
                    branchId);

            Result<List<LakebaseAutoscalingEndpointOption>> endpointsResult =
                await GetEndpointOptionsAsync(userId, workspaceConnectionId, workspaceUrl, projectId, projectDisplayName, branchName, branchId);
            if (endpointsResult.IsFailed)
            {
                return Result.Fail<List<LakebaseAutoscalingBranchOption>>(endpointsResult.Errors);
            }

            List<LakebaseAutoscalingEndpointOption> mergedEndpoints = MergeLakebaseEndpointOptions(
                fromDatabases,
                endpointsResult.Value);
            ApplyBranchConnectionEndpointFallback(
                mergedEndpoints,
                endpointsResult.Value);

            await EnrichLakebaseLogicalNamesFromDetailGetsAsync(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                projectId,
                branchId,
                mergedEndpoints);
            await BackfillDatabaseNamesFromDatabaseCatalogAsync(
                userId,
                workspaceConnectionId,
                workspaceUrl,
                projectId,
                branchId,
                mergedEndpoints);

            branches.Add(new LakebaseAutoscalingBranchOption
            {
                BranchName = FirstNonUuidLike(
                    GetNestedString(branchElement, "spec", "display_name"),
                    GetString(branchElement, "display_name"),
                    branchId),
                BranchId = branchId,
                IsDefault = isDefault,
                Endpoints = mergedEndpoints
                    .OrderBy(static e => e.EndpointName, StringComparer.OrdinalIgnoreCase)
                    .ToList(),
            });
        }

        List<LakebaseAutoscalingBranchOption> ordered = branches
            .OrderByDescending(static b => b.IsDefault)
            .ThenBy(static b => b.BranchName, StringComparer.OrdinalIgnoreCase)
            .ToList();
        return Result.Ok(ordered);
    }

    /// <summary>
    /// Logical Postgres / Unity Catalog database name from a Lakebase <c>database</c> resource JSON object
    /// (list item or <c>GET ΓÇª/databases/{id}</c> response).
    /// </summary>
    private static string ResolveLakebaseDatabaseResourceLogicalName(JsonElement dbEl, string wireResourceId)
    {
        string? fullNameForPath = GetString(dbEl, "name");
        return FirstLakebaseLogicalDatabaseName(
            wireResourceId,
            TryLogicalNameFromDatabasesPathSegment(fullNameForPath),
            GetNestedString(dbEl, "spec", "database_name"),
            GetNestedString(dbEl, "spec", "display_name"),
            GetNestedString(dbEl, "spec", "postgres_database_name"),
            GetNestedString(dbEl, "spec", "logical_database_name"),
            GetStringByPath(dbEl, "spec", "metadata", "display_name"),
            GetStringByPath(dbEl, "spec", "metadata", "name"),
            GetStringByPath(dbEl, "spec", "metadata", "database_name"),
            GetString(dbEl, "database_name"),
            GetString(dbEl, "postgres_database_name"),
            GetString(dbEl, "logical_database_name"),
            GetString(dbEl, "instance_name"),
            GetNestedString(dbEl, "metadata", "display_name"),
            GetNestedString(dbEl, "metadata", "name"),
            GetNestedString(dbEl, "metadata", "database_name"),
            GetNestedString(dbEl, "info", "database_name"),
            GetString(dbEl, "display_name"),
            GetNestedString(dbEl, "status", "database_name"),
            GetNestedString(dbEl, "status", "display_name"),
            GetNestedString(dbEl, "status", "postgres_database_name"),
            GetNestedString(dbEl, "spec", "name"),
            GetString(dbEl, "title"));
    }

    private static bool TryGetLakebaseAppsDatabaseWireId(
        LakebaseAutoscalingEndpointOption option,
        out string wireId)
    {
        string apps = option.AppsDatabaseResourceId?.Trim() ?? string.Empty;
        if (apps.StartsWith("db-", StringComparison.OrdinalIgnoreCase))
        {
            wireId = apps;
            return true;
        }

        string ep = option.EndpointId?.Trim() ?? string.Empty;
        if (ep.StartsWith("db-", StringComparison.OrdinalIgnoreCase))
        {
            wireId = ep;
            return true;
        }

        wireId = string.Empty;
        return false;
    }

    private static void ApplyEnrichedPostgresLogicalName(
        LakebaseAutoscalingEndpointOption option,
        string logicalName,
        string wireId)
    {
        option.PostgresDatabaseName = logicalName;
        bool isDatabaseResourceRow =
            option.EndpointType.Equals("DATABASE_RESOURCE", StringComparison.OrdinalIgnoreCase)
            || option.EndpointId.Trim().Equals(wireId, StringComparison.OrdinalIgnoreCase);
        if (isDatabaseResourceRow)
        {
            option.SelectorDisplay.SecondaryLabel = logicalName;
        }
    }

    /// <summary>
    /// When list responses only include <c>db-ΓÇª</c> fields, <c>GET ΓÇª/databases/{id}</c> (and optionally
    /// <c>GET ΓÇª/endpoints/{id}</c>) often returns a richer document with <c>database_name</c> / metadata.
    /// </summary>
    private async Task EnrichLakebaseLogicalNamesFromDetailGetsAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string projectId,
        string branchId,
        List<LakebaseAutoscalingEndpointOption> endpoints)
    {
        if (endpoints.Count == 0)
        {
            return;
        }

        Dictionary<string, string?> detailCacheByWire = new(StringComparer.OrdinalIgnoreCase);
        foreach (LakebaseAutoscalingEndpointOption option in endpoints)
        {
            if (!TryGetLakebaseAppsDatabaseWireId(option, out string? wireId))
            {
                continue;
            }

            if (IsLakebaseLogicalDatabaseDisplayName(option.PostgresDatabaseName, wireId))
            {
                continue;
            }

            if (!detailCacheByWire.TryGetValue(wireId, out string? resolvedFromDetail))
            {
                Result<JsonElement> detail = await TryFetchPostgresDatabaseResourceDetailAsync(
                    userId,
                    workspaceConnectionId,
                    workspaceUrl,
                    projectId,
                    branchId,
                    wireId);
                if (detail.IsSuccess)
                {
                    string candidate = ResolveLakebaseDatabaseResourceLogicalName(detail.Value, wireId);
                    resolvedFromDetail = IsLakebaseLogicalDatabaseDisplayName(candidate, wireId)
                        ? candidate
                        : null;
                }
                else
                {
                    resolvedFromDetail = null;
                    _logger.LogDebug(
                        "Lakebase GET database detail failed for wire {WireId} project {ProjectId} branch {BranchId}: {Errors}",
                        wireId,
                        projectId,
                        branchId,
                        string.Join("; ", detail.Errors.Select(e => e.Message)));
                }

                detailCacheByWire[wireId] = resolvedFromDetail;
            }

            if (!string.IsNullOrWhiteSpace(resolvedFromDetail))
            {
                ApplyEnrichedPostgresLogicalName(option, resolvedFromDetail!, wireId);
            }
        }

        foreach (LakebaseAutoscalingEndpointOption option in endpoints)
        {
            if (!TryGetLakebaseAppsDatabaseWireId(option, out string? wireId))
            {
                continue;
            }

            if (IsLakebaseLogicalDatabaseDisplayName(option.PostgresDatabaseName, wireId))
            {
                continue;
            }

            string epId = option.EndpointId.Trim();
            if (!epId.StartsWith("ep-", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            string endpointUrl =
                $"/api/2.0/postgres/projects/{Uri.EscapeDataString(projectId.Trim())}/branches/{Uri.EscapeDataString(branchId.Trim())}/endpoints/{Uri.EscapeDataString(epId)}";
            Result<JsonElement> epDetail =
                await _databricksApi.GetAsync<JsonElement>(userId, workspaceConnectionId, workspaceUrl, endpointUrl);
            if (epDetail.IsFailed)
            {
                _logger.LogDebug(
                    "Lakebase GET endpoint detail failed for {EndpointId}: {Errors}",
                    epId,
                    string.Join("; ", epDetail.Errors.Select(e => e.Message)));
                continue;
            }

            (string appsId, string postgresName) = ParseEndpointDatabaseWireAndPostgresName(epDetail.Value, epId);
            string wireForCheck = FirstNonEmpty(appsId, wireId);
            if (IsLakebaseLogicalDatabaseDisplayName(postgresName, wireForCheck))
            {
                ApplyEnrichedPostgresLogicalName(option, postgresName, wireId);
            }
        }
    }

    /// <summary>
    /// Fetches a single database resource by id under the same Postgres API branch scope as the list call
    /// (<c>GET ΓÇª/databases/{database_id}</c>), trying the bare id and a fully-qualified resource name segment
    /// when the control plane expects the latter.
    /// </summary>
    private async Task<Result<JsonElement>> TryFetchPostgresDatabaseResourceDetailAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string projectId,
        string branchId,
        string wireId)
    {
        string w = wireId.Trim();
        string p = projectId.Trim();
        string b = branchId.Trim();
        string databasesBase =
            $"/api/2.0/postgres/projects/{Uri.EscapeDataString(p)}/branches/{Uri.EscapeDataString(b)}/databases";
        string[] urls =
        [
            $"{databasesBase}/{Uri.EscapeDataString(w)}",
            $"{databasesBase}/{Uri.EscapeDataString($"projects/{p}/branches/{b}/databases/{w}")}",
        ];
        foreach (string url in urls)
        {
            Result<JsonElement> r = await _databricksApi.GetAsync<JsonElement>(userId, workspaceConnectionId, workspaceUrl, url);
            if (r.IsSuccess)
            {
                return r;
            }
        }

        return Result.Fail<JsonElement>("Postgres database detail requests failed");
    }

    private static (string AppsDatabaseResourceId, string PostgresDatabaseName) ParseEndpointDatabaseWireAndPostgresName(
        JsonElement endpointElement,
        string endpointId)
    {
        string? specDatabaseResource =
            GetNestedString(endpointElement, "spec", "database")
            ?? GetNestedString(endpointElement, "spec", "database_resource")
            ?? GetNestedString(endpointElement, "status", "database")
            ?? GetString(endpointElement, "database");
        string appsDatabaseResourceId = string.Empty;
        if (!string.IsNullOrWhiteSpace(specDatabaseResource))
        {
            string s = specDatabaseResource.Trim();
            if (s.Contains("/databases/", StringComparison.Ordinal))
            {
                appsDatabaseResourceId = GetResourceId(s);
            }
            else if (!s.Contains('/') && !s.Contains(' ', StringComparison.Ordinal))
            {
                appsDatabaseResourceId = s;
            }
        }

        string wireForLogicalDbName = FirstNonEmpty(appsDatabaseResourceId, endpointId);
        string postgresDatabaseName = FirstLakebaseLogicalDatabaseName(
            wireForLogicalDbName,
            GetNestedString(endpointElement, "spec", "database_name"),
            GetString(endpointElement, "database_name"),
            GetNestedString(endpointElement, "status", "database_name"),
            GetNestedString(endpointElement, "spec", "postgres_database_name"),
            GetNestedString(endpointElement, "spec", "logical_database_name"),
            GetString(endpointElement, "postgres_database_name"),
            GetString(endpointElement, "logical_database_name"),
            GetStringByPath(endpointElement, "spec", "metadata", "database_name"),
            GetStringByPath(endpointElement, "spec", "metadata", "name"),
            GetNestedString(endpointElement, "metadata", "database_name"),
            GetStringByPath(endpointElement, "status", "metadata", "database_name"),
            TryLogicalNameFromDatabasesPathSegment(specDatabaseResource));

        return (appsDatabaseResourceId, postgresDatabaseName);
    }

    /// <summary>
    /// Lists database resources for a Lakebase Postgres branch using the Workspace Postgres API:
    /// <c>GET /api/2.0/postgres/projects/{project_id}/branches/{branch_id}/databases</c> with
    /// <c>page_size</c> / <c>page_token</c> pagination and a <c>databases</c> array in each page.
    /// Logical Postgres names are read only from each database object (and from per-database GET in
    /// <see cref="EnrichLakebaseLogicalNamesFromDetailGetsAsync"/>); there are no workspace-invented defaults.
    /// </summary>
    /// <seealso href="https://docs.databricks.com/api/workspace/postgres">Databricks Workspace Postgres API</seealso>
    private async Task<List<LakebaseAutoscalingEndpointOption>> TryLoadBranchDatabaseResourceOptionsAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string projectId,
        string projectDisplayName,
        string branchName,
        string branchId)
    {
        string listDatabasesEndpoint =
            $"/api/2.0/postgres/projects/{Uri.EscapeDataString(projectId)}/branches/{Uri.EscapeDataString(branchId)}/databases";
        Result<List<JsonElement>> databasesResult = await GetPagedCollectionAsync(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            listDatabasesEndpoint,
            "databases");
        if (databasesResult.IsFailed)
        {
            _logger.LogDebug(
                "Branch databases list unavailable for project {ProjectId} branch {BranchId}: {Errors}",
                projectId,
                branchId,
                string.Join("; ", databasesResult.Errors.Select(e => e.Message)));
            return new List<LakebaseAutoscalingEndpointOption>();
        }

        List<LakebaseAutoscalingEndpointOption> list = [];
        foreach (JsonElement dbEl in databasesResult.Value)
        {
            string? fullName = GetString(dbEl, "name");
            string resourceId = GetResourceId(fullName ?? string.Empty);
            if (string.IsNullOrWhiteSpace(resourceId))
            {
                continue;
            }

            string logicalName = ResolveLakebaseDatabaseResourceLogicalName(dbEl, resourceId);

            list.Add(new LakebaseAutoscalingEndpointOption
            {
                PostgresDatabaseName = logicalName,
                AppsDatabaseResourceId = resourceId,
                EndpointName = resourceId,
                EndpointId = resourceId,
                EndpointType = "DATABASE_RESOURCE",
                SelectorDisplay = new LakebaseAutoscalingSelectorDisplay
                {
                    PrimaryLabel = $"{projectDisplayName} / {branchName} / {resourceId}",
                    SecondaryLabel = logicalName,
                    SearchText = $"{projectId} {branchId} {resourceId} {logicalName}",
                },
            });
        }

        return list;
    }

    /// <summary>
    /// Prefer explicit database resource rows (correct Apps <c>database_id</c>), then endpoints.
    /// </summary>
    private static List<LakebaseAutoscalingEndpointOption> MergeLakebaseEndpointOptions(
        List<LakebaseAutoscalingEndpointOption> databaseResources,
        List<LakebaseAutoscalingEndpointOption> endpoints)
    {
        bool hasExplicitDatabaseResources = databaseResources.Count > 0;
        Dictionary<string, LakebaseAutoscalingEndpointOption> byKey = new(StringComparer.OrdinalIgnoreCase);
        foreach (LakebaseAutoscalingEndpointOption o in databaseResources)
        {
            string key = !string.IsNullOrWhiteSpace(o.AppsDatabaseResourceId)
                ? o.AppsDatabaseResourceId.Trim()
                : o.EndpointId.Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            byKey[key] = o;
        }

        foreach (LakebaseAutoscalingEndpointOption o in endpoints)
        {
            bool isDatabaseLinkedEndpoint =
                !string.IsNullOrWhiteSpace(o.AppsDatabaseResourceId)
                || o.EndpointId.Trim().StartsWith("db-", StringComparison.OrdinalIgnoreCase);
            if (!isDatabaseLinkedEndpoint && hasExplicitDatabaseResources)
            {
                continue;
            }

            string key = !string.IsNullOrWhiteSpace(o.AppsDatabaseResourceId)
                ? o.AppsDatabaseResourceId.Trim()
                : o.EndpointId.Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            if (!byKey.TryGetValue(key, out LakebaseAutoscalingEndpointOption? existing))
            {
                byKey[key] = o;
                continue;
            }

            // Keep the database-resource row as the canonical entry, but enrich its human label
            // from endpoint payloads when available (UI should show logical DB name, not db-... id).
            if (!IsLakebaseLogicalDatabaseDisplayName(existing.PostgresDatabaseName, existing.EndpointId)
                && IsLakebaseLogicalDatabaseDisplayName(o.PostgresDatabaseName, existing.EndpointId))
            {
                existing.PostgresDatabaseName = o.PostgresDatabaseName.Trim();
                existing.SelectorDisplay.SecondaryLabel = existing.PostgresDatabaseName;
            }

            if (string.IsNullOrWhiteSpace(existing.AppsDatabaseResourceId)
                && !string.IsNullOrWhiteSpace(o.AppsDatabaseResourceId))
            {
                existing.AppsDatabaseResourceId = o.AppsDatabaseResourceId;
            }

            if (string.IsNullOrWhiteSpace(existing.ConnectionEndpointId)
                && !string.IsNullOrWhiteSpace(o.ConnectionEndpointId))
            {
                existing.ConnectionEndpointId = o.ConnectionEndpointId;
            }

            if (string.IsNullOrWhiteSpace(existing.ConnectionHost)
                && !string.IsNullOrWhiteSpace(o.ConnectionHost))
            {
                existing.ConnectionHost = o.ConnectionHost;
            }
        }

        return byKey.Values.ToList();
    }

    private static void ApplyBranchConnectionEndpointFallback(
        List<LakebaseAutoscalingEndpointOption> mergedEndpoints,
        List<LakebaseAutoscalingEndpointOption> computeEndpoints)
    {
        LakebaseAutoscalingEndpointOption? preferredCompute = computeEndpoints.FirstOrDefault(
            static endpoint =>
                endpoint.EndpointId.Trim().StartsWith("ep-", StringComparison.OrdinalIgnoreCase)
                && endpoint.EndpointType.Equals("ENDPOINT_TYPE_READ_WRITE", StringComparison.OrdinalIgnoreCase))
            ?? computeEndpoints.FirstOrDefault(
                static endpoint => endpoint.EndpointId.Trim().StartsWith("ep-", StringComparison.OrdinalIgnoreCase));
        if (preferredCompute == null)
        {
            return;
        }

        string fallbackEndpointId = preferredCompute.ConnectionEndpointId?.Trim() ?? preferredCompute.EndpointId.Trim();
        string fallbackHost = preferredCompute.ConnectionHost?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(fallbackEndpointId))
        {
            return;
        }

        foreach (LakebaseAutoscalingEndpointOption endpoint in mergedEndpoints)
        {
            bool isDatabaseResource =
                endpoint.EndpointType.Equals("DATABASE_RESOURCE", StringComparison.OrdinalIgnoreCase)
                || endpoint.EndpointId.Trim().StartsWith("db-", StringComparison.OrdinalIgnoreCase)
                || endpoint.AppsDatabaseResourceId.Trim().StartsWith("db-", StringComparison.OrdinalIgnoreCase);
            if (!isDatabaseResource)
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(endpoint.ConnectionEndpointId))
            {
                endpoint.ConnectionEndpointId = fallbackEndpointId;
            }

            if (string.IsNullOrWhiteSpace(endpoint.ConnectionHost) && !string.IsNullOrWhiteSpace(fallbackHost))
            {
                endpoint.ConnectionHost = fallbackHost;
            }
        }
    }

    private async Task BackfillDatabaseNamesFromDatabaseCatalogAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string projectId,
        string branchId,
        List<LakebaseAutoscalingEndpointOption> endpoints)
    {
        List<LakebaseAutoscalingEndpointOption> databaseResources = endpoints
            .Where(static endpoint =>
                endpoint.EndpointType.Equals("DATABASE_RESOURCE", StringComparison.OrdinalIgnoreCase)
                || endpoint.EndpointId.Trim().StartsWith("db-", StringComparison.OrdinalIgnoreCase)
                || endpoint.AppsDatabaseResourceId.Trim().StartsWith("db-", StringComparison.OrdinalIgnoreCase))
            .ToList();
        List<LakebaseAutoscalingEndpointOption> unresolved = databaseResources
            .Where(static endpoint =>
            {
                string wireId = !string.IsNullOrWhiteSpace(endpoint.AppsDatabaseResourceId)
                    ? endpoint.AppsDatabaseResourceId.Trim()
                    : endpoint.EndpointId.Trim();
                return !IsLakebaseLogicalDatabaseDisplayName(endpoint.PostgresDatabaseName, wireId);
            })
            .ToList();
        if (unresolved.Count == 0)
        {
            return;
        }

        string endpointId = unresolved
            .Select(static endpoint => endpoint.ConnectionEndpointId?.Trim() ?? string.Empty)
            .FirstOrDefault(static value => !string.IsNullOrWhiteSpace(value))
            ?? string.Empty;
        string host = unresolved
            .Select(static endpoint => endpoint.ConnectionHost?.Trim() ?? string.Empty)
            .FirstOrDefault(static value => !string.IsNullOrWhiteSpace(value))
            ?? string.Empty;
        if (string.IsNullOrWhiteSpace(endpointId) || string.IsNullOrWhiteSpace(host))
        {
            return;
        }

        Result<string> usernameResult = await GetCurrentLakebaseUsernameAsync(userId, workspaceConnectionId, workspaceUrl);
        if (usernameResult.IsFailed)
        {
            _logger.LogDebug(
                "Skipping Lakebase database-name backfill because current-user lookup failed for project {ProjectId} branch {BranchId}: {Errors}",
                projectId,
                branchId,
                string.Join("; ", usernameResult.Errors.Select(e => e.Message)));
            return;
        }

        Result<string> credentialResult = await GenerateLakebaseDatabaseCredentialAsync(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            $"projects/{projectId}/branches/{branchId}/endpoints/{endpointId}");
        if (credentialResult.IsFailed)
        {
            _logger.LogDebug(
                "Skipping Lakebase database-name backfill because credential generation failed for project {ProjectId} branch {BranchId}: {Errors}",
                projectId,
                branchId,
                string.Join("; ", credentialResult.Errors.Select(e => e.Message)));
            return;
        }

        string? username = usernameResult.ValueOrDefault;
        string? password = credentialResult.ValueOrDefault;
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        Result<List<string>> databaseNamesResult = await ListDatabaseNamesAsync(
            host,
            username,
            password);
        if (databaseNamesResult.IsFailed)
        {
            return;
        }

        List<string> databaseNames = databaseNamesResult.ValueOrDefault;
        if (databaseNames.Count == 0)
        {
            return;
        }

        HashSet<string> usedNames = databaseResources
            .Select(static endpoint => endpoint.PostgresDatabaseName?.Trim() ?? string.Empty)
            .Where(static value => !string.IsNullOrWhiteSpace(value) && !value.StartsWith("db-", StringComparison.OrdinalIgnoreCase))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        List<string> availableNames = databaseNames
            .Where(name => !usedNames.Contains(name))
            .ToList();
        if (availableNames.Count == 0)
        {
            return;
        }

        LakebaseAutoscalingEndpointOption? defaultDatabase = unresolved.FirstOrDefault();
        int defaultIndex = availableNames.FindIndex(
            static name => name.Equals("databricks_postgres", StringComparison.OrdinalIgnoreCase));
        if (defaultDatabase != null && defaultIndex >= 0)
        {
            string defaultWireId = !string.IsNullOrWhiteSpace(defaultDatabase.AppsDatabaseResourceId)
                ? defaultDatabase.AppsDatabaseResourceId.Trim()
                : defaultDatabase.EndpointId.Trim();
            ApplyEnrichedPostgresLogicalName(defaultDatabase, availableNames[defaultIndex], defaultWireId);
            availableNames.RemoveAt(defaultIndex);
            unresolved.Remove(defaultDatabase);
        }

        if (unresolved.Count == 1 && availableNames.Count >= 1)
        {
            LakebaseAutoscalingEndpointOption endpoint = unresolved[0];
            string wireId = !string.IsNullOrWhiteSpace(endpoint.AppsDatabaseResourceId)
                ? endpoint.AppsDatabaseResourceId.Trim()
                : endpoint.EndpointId.Trim();
            ApplyEnrichedPostgresLogicalName(endpoint, availableNames[0], wireId);
            return;
        }

        if (unresolved.Count == availableNames.Count)
        {
            for (int i = 0; i < unresolved.Count; i++)
            {
                LakebaseAutoscalingEndpointOption endpoint = unresolved[i];
                string wireId = !string.IsNullOrWhiteSpace(endpoint.AppsDatabaseResourceId)
                    ? endpoint.AppsDatabaseResourceId.Trim()
                    : endpoint.EndpointId.Trim();
                ApplyEnrichedPostgresLogicalName(endpoint, availableNames[i], wireId);
            }
        }
    }

    private async Task<Result<List<string>>> ListDatabaseNamesAsync(
        string host,
        string username,
        string password)
    {
        LakebaseAutoscalingConnectionContext connection = new()
        {
            Host = host,
            DatabaseName = "databricks_postgres",
            Username = username,
            Password = password,
        };
        return await ListDatabaseNamesAsync(connection);
    }

    private async Task<Result<List<string>>> ListDatabaseNamesAsync(
        LakebaseAutoscalingConnectionContext connection)
    {
        const string sql = """
            SELECT datname
            FROM pg_database
            WHERE datistemplate = false
            ORDER BY datname;
            """;

        try
        {
            await using NpgsqlConnection dbConnection = await OpenLakebaseConnectionAsync(connection);
            await using NpgsqlCommand command = new(sql, dbConnection)
            {
                CommandTimeout = 30,
            };

            List<string> databases = [];
            await using NpgsqlDataReader reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                string? databaseName = reader.IsDBNull(0) ? null : reader.GetString(0);
                if (!string.IsNullOrWhiteSpace(databaseName))
                {
                    databases.Add(databaseName.Trim());
                }
            }

            return Result.Ok(databases);
        }
        catch (NpgsqlException ex)
        {
            _logger.LogWarning(
                ex,
                "Lakebase database discovery failed for host {Host}",
                connection.Host);
            return Result.Fail<List<string>>(
                new UpstreamDependencyError(
                    BuildLakebaseMetadataFailureMessage(
                        "databases",
                        connection.DatabaseName,
                        ex)));
        }
    }

    private async Task<Result<List<LakebaseAutoscalingEndpointOption>>> GetEndpointOptionsAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string projectId,
        string projectDisplayName,
        string branchName,
        string branchId)
    {
        string listEndpointsEndpoint = $"/api/2.0/postgres/projects/{Uri.EscapeDataString(projectId)}/branches/{Uri.EscapeDataString(branchId)}/endpoints";
        Result<List<JsonElement>> endpointsResult = await GetPagedCollectionAsync(
            userId,
            workspaceConnectionId,
            workspaceUrl,
            listEndpointsEndpoint,
            "endpoints");
        if (endpointsResult.IsFailed)
        {
            return Result.Fail<List<LakebaseAutoscalingEndpointOption>>(endpointsResult.Errors);
        }

        List<LakebaseAutoscalingEndpointOption> endpoints = [];
        foreach (JsonElement endpointElement in endpointsResult.Value)
        {
            string? endpointName = GetString(endpointElement, "name");
            if (string.IsNullOrWhiteSpace(endpointName))
            {
                _logger.LogWarning("Skipping endpoint without a valid name under branch {branchName}", branchName);
                continue;
            }

            string endpointId = FirstNonEmpty(
                GetResourceId(endpointName),
                GetString(endpointElement, "endpoint_id"),
                GetNestedString(endpointElement, "spec", "endpoint_id"),
                GetString(endpointElement, "id"));
            if (string.IsNullOrWhiteSpace(endpointId))
            {
                _logger.LogWarning("Skipping endpoint with unparsable name {endpointName} under branch {branchName}", endpointName, branchName);
                continue;
            }

            string endpointType =
                GetString(endpointElement, "endpoint_type")
                ?? GetNestedString(endpointElement, "spec", "endpoint_type")
                ?? string.Empty;
            double? minCu =
                GetDouble(endpointElement, "autoscaling_limit_min_cu")
                ?? GetNestedDouble(endpointElement, "spec", "autoscaling_limit_min_cu");
            double? maxCu =
                GetDouble(endpointElement, "autoscaling_limit_max_cu")
                ?? GetNestedDouble(endpointElement, "spec", "autoscaling_limit_max_cu");
            string? suspendTimeoutDuration =
                GetString(endpointElement, "suspend_timeout_duration")
                ?? GetNestedString(endpointElement, "spec", "suspend_timeout_duration");
            string? effectiveStatus =
                GetNestedString(endpointElement, "status", "state")
                ?? GetString(endpointElement, "state");
            string endpointHost =
                GetStringByPath(endpointElement, "status", "hosts", "host")?.Trim()
                ?? string.Empty;

            string minMaxLabel = minCu.HasValue || maxCu.HasValue
                ? $"{(minCu?.ToString("0.##") ?? "?")}-{(maxCu?.ToString("0.##") ?? "?")} CU"
                : "CU unknown";

            (string appsDatabaseResourceId, string postgresDatabaseName) =
                ParseEndpointDatabaseWireAndPostgresName(endpointElement, endpointId);

            endpoints.Add(new LakebaseAutoscalingEndpointOption
            {
                PostgresDatabaseName = postgresDatabaseName,
                AppsDatabaseResourceId = appsDatabaseResourceId,
                EndpointName = FirstNonUuidLike(
                    GetNestedString(endpointElement, "spec", "display_name"),
                    GetString(endpointElement, "display_name"),
                    endpointId),
                EndpointId = endpointId,
                EndpointType = endpointType,
                AutoscalingLimitMinCu = minCu,
                AutoscalingLimitMaxCu = maxCu,
                SuspendTimeoutDuration = suspendTimeoutDuration,
                EffectiveStatus = effectiveStatus,
                ConnectionEndpointId = endpointId,
                ConnectionHost = endpointHost,
                SelectorDisplay = new LakebaseAutoscalingSelectorDisplay
                {
                    PrimaryLabel = $"{projectDisplayName} / {branchName} / {endpointId}",
                    SecondaryLabel = $"{endpointType} | {minMaxLabel}",
                    SearchText = $"{projectDisplayName} {projectId} {branchName} {branchId} {endpointName} {endpointType}",
                },
            });
        }

        return Result.Ok(endpoints);
    }

    private async Task<Result<List<JsonElement>>> GetPagedCollectionAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string baseEndpoint,
        string collectionPropertyName)
    {
        List<JsonElement> items = [];
        string? nextPageToken = null;
        const int pageSize = 100;
        const int maxPages = 100;
        int pageCount = 0;

        do
        {
            pageCount++;
            if (pageCount > maxPages)
            {
                _logger.LogError("Exceeded max pages while querying endpoint {baseEndpoint}", baseEndpoint);
                return Result.Fail<List<JsonElement>>(new UpstreamDependencyError($"Databricks pagination exceeded {maxPages} pages for {collectionPropertyName}."));
            }

            string endpoint = BuildPagedEndpoint(baseEndpoint, pageSize, nextPageToken);
            Result<JsonElement> pageResult = await _databricksApi.GetAsync<JsonElement>(userId, workspaceConnectionId, workspaceUrl, endpoint);
            if (pageResult.IsFailed)
            {
                return Result.Fail<List<JsonElement>>(pageResult.Errors);
            }

            JsonElement response = pageResult.ValueOrDefault;
            if (response.ValueKind != JsonValueKind.Object)
            {
                _logger.LogWarning("Skipping malformed Databricks response from {endpoint}: expected object", endpoint);
                nextPageToken = null;
                continue;
            }

            if (response.TryGetProperty(collectionPropertyName, out JsonElement collectionElement)
                && collectionElement.ValueKind == JsonValueKind.Array)
            {
                foreach (JsonElement item in collectionElement.EnumerateArray())
                {
                    items.Add(item.Clone());
                }
            }
            else
            {
                _logger.LogWarning("Databricks response from {endpoint} missing array property '{propertyName}'", endpoint, collectionPropertyName);
            }

            nextPageToken = GetString(response, "next_page_token");
        }
        while (!string.IsNullOrWhiteSpace(nextPageToken));

        return Result.Ok(items);
    }

    private static string BuildPagedEndpoint(string baseEndpoint, int pageSize, string? nextPageToken)
    {
        string separator = baseEndpoint.Contains('?', StringComparison.Ordinal) ? "&" : "?";
        string endpoint = $"{baseEndpoint}{separator}page_size={pageSize}";
        if (!string.IsNullOrWhiteSpace(nextPageToken))
        {
            endpoint = $"{endpoint}&page_token={Uri.EscapeDataString(nextPageToken)}";
        }

        return endpoint;
    }

    private static string? GetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out JsonElement property))
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static string? GetNestedString(JsonElement element, string parentPropertyName, string childPropertyName)
    {
        if (!element.TryGetProperty(parentPropertyName, out JsonElement parent)
            || parent.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return GetString(parent, childPropertyName);
    }

    /// <summary>
    /// Reads a nested string by walking object properties (e.g. <c>spec.metadata.display_name</c>).
    /// </summary>
    private static string? GetStringByPath(JsonElement element, params string[] path)
    {
        if (path.Length == 0)
        {
            return null;
        }

        JsonElement current = element;
        for (int i = 0; i < path.Length - 1; i++)
        {
            if (!current.TryGetProperty(path[i], out JsonElement next) || next.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            current = next;
        }

        return GetString(current, path[path.Length - 1]);
    }

    /// <summary>
    /// When <paramref name="fullName"/> is a resource path ending in <c>.../databases/{segment}</c>,
    /// returns <paramref name="segment"/> only if it is not a Databricks Apps wire id (<c>db-ΓÇª</c>) and not UUID-like.
    /// </summary>
    private static string? TryLogicalNameFromDatabasesPathSegment(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return null;
        }

        const string databases = "/databases/";
        int idx = fullName.LastIndexOf(databases, StringComparison.Ordinal);
        if (idx < 0 || idx + databases.Length >= fullName.Length)
        {
            return null;
        }

        string tail = fullName[(idx + databases.Length)..].Trim();
        if (string.IsNullOrWhiteSpace(tail)
            || tail.StartsWith("db-", StringComparison.OrdinalIgnoreCase)
            || IsLikelyUuid(tail))
        {
            return null;
        }

        return tail;
    }

    /// <summary>
    /// True when <paramref name="candidate"/> is suitable as a Unity Catalog / logical Postgres catalog name:
    /// non-empty, not UUID-like, not the Apps database wire id, and not a <c>db-ΓÇª</c> resource id.
    /// </summary>
    private static bool IsLakebaseLogicalDatabaseDisplayName(string? candidate, string wireResourceId)
    {
        string c = candidate?.Trim() ?? string.Empty;
        string w = wireResourceId?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(c))
        {
            return false;
        }

        if (IsLikelyUuid(c))
        {
            return false;
        }

        if (!string.IsNullOrEmpty(w) && c.Equals(w, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (c.StartsWith("db-", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return true;
    }

    /// <summary>
    /// Prefer human-readable database names for UC / Postgres over Databricks wire ids: the first pass skips
    /// <c>db-ΓÇª</c> and values equal to <paramref name="wireResourceId"/> so a later field like
    /// <c>databricks_postgres</c> can win over an earlier <c>db-compat-ΓÇª</c> in the payload.
    /// Falls back to <see cref="FirstNonUuidLike"/> when no better candidate exists.
    /// </summary>
    private static string FirstLakebaseLogicalDatabaseName(
        string wireResourceId,
        params string?[] candidates)
    {
        foreach (string? raw in candidates)
        {
            string candidate = raw?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            if (IsLakebaseLogicalDatabaseDisplayName(candidate, wireResourceId))
            {
                return candidate;
            }
        }

        return FirstNonUuidLike(candidates);
    }

    private static bool? GetBool(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out JsonElement property))
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.True
            ? true
            : property.ValueKind == JsonValueKind.False
                ? false
                : null;
    }

    private static bool? GetNestedBool(JsonElement element, string parentPropertyName, string childPropertyName)
    {
        if (!element.TryGetProperty(parentPropertyName, out JsonElement parent)
            || parent.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return GetBool(parent, childPropertyName);
    }

    private static double? GetDouble(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out JsonElement property))
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.Number && property.TryGetDouble(out double value)
            ? value
            : null;
    }

    private static double? GetNestedDouble(JsonElement element, string parentPropertyName, string childPropertyName)
    {
        if (!element.TryGetProperty(parentPropertyName, out JsonElement parent)
            || parent.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return GetDouble(parent, childPropertyName);
    }

    private static string GetResourceId(string resourceName)
    {
        if (string.IsNullOrWhiteSpace(resourceName))
        {
            return string.Empty;
        }

        int separatorIndex = resourceName.LastIndexOf('/');
        return separatorIndex >= 0 && separatorIndex < resourceName.Length - 1
            ? resourceName[(separatorIndex + 1)..]
            : resourceName;
    }

    /// <summary>
    /// Resolves the same style of project name shown in the workspace Lakebase projects UI
    /// (e.g. <c>/lakebase/projects</c>) from the Postgres projects API (<c>/api/2.0/postgres/projects</c>).
    /// </summary>
    private static string ResolveLakebaseProjectDisplayName(
        JsonElement projectElement,
        string projectName,
        string projectId)
    {
        string? projectNameId = GetResourceId(projectName);
        return FirstNonUuidLike(
            GetString(projectElement, "project_name"),
            GetNestedString(projectElement, "spec", "project_name"),
            GetNestedString(projectElement, "spec", "display_name"),
            GetString(projectElement, "display_name"),
            GetString(projectElement, "title"),
            GetNestedString(projectElement, "metadata", "name"),
            GetNestedString(projectElement, "spec", "name"),
            GetNestedString(projectElement, "status", "display_name"),
            projectNameId,
            projectId);
    }

    private static string FirstNonUuidLike(params string?[] values)
    {
        foreach (string? raw in values)
        {
            string candidate = raw?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            if (!IsLikelyUuid(candidate))
            {
                return candidate;
            }
        }

        foreach (string? raw in values)
        {
            string candidate = raw?.Trim() ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(candidate))
            {
                return candidate;
            }
        }

        return string.Empty;
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (string? raw in values)
        {
            string candidate = raw?.Trim() ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(candidate))
            {
                return candidate;
            }
        }

        return string.Empty;
    }

    private static bool IsLikelyUuid(string value)
    {
        string trimmed = value.Trim();
        if (trimmed.Length == 36 && Guid.TryParse(trimmed, out _))
        {
            return true;
        }

        int slashIndex = trimmed.LastIndexOf('/');
        if (slashIndex >= 0 && slashIndex < trimmed.Length - 1)
        {
            string tail = trimmed[(slashIndex + 1)..];
            if (tail.Length == 36 && Guid.TryParse(tail, out _))
            {
                return true;
            }
        }

        return false;
    }

    private async Task<Result<LakebaseDatabaseInstance>> GetDatabaseInstanceByNameFromDatabricksAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string instanceName)
    {
        try
        {
            string apiUrl = DatabricksApiRoutes.DatabaseInstanceByNamePath(Uri.EscapeDataString(instanceName));
            _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

            Result<DatabricksDatabaseInstanceInfo> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksDatabaseInstanceInfo>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<LakebaseDatabaseInstance>(apiResponseResult.Errors);
            }

            DatabricksDatabaseInstanceInfo? row = apiResponseResult.ValueOrDefault;
            if (row == null || string.IsNullOrWhiteSpace(row.Name))
            {
                return Result.Fail<LakebaseDatabaseInstance>($"Database instance '{instanceName}' not found");
            }

            LakebaseDatabaseInstance mapped = new()
            {
                Name = row.Name,
                ReadWriteDns = row.ReadWriteDns,
                DatabaseName = row.DatabaseName,
            };
            return Result.Ok(mapped);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks database instance API for {instanceName}", instanceName);
            return Result.Fail<LakebaseDatabaseInstance>("Failed to communicate with Databricks API");
        }
    }

    private async Task<Result<List<LakebaseDatabaseCatalog>>> GetDatabaseCatalogFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl, string catalogName)
    {
        try
        {
            string apiUrl = DatabricksApiRoutes.DatabaseCatalogsByCatalogNamePath(Uri.EscapeDataString(catalogName));
            _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

            Result<DatabricksDatabaseCatalogResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksDatabaseCatalogResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<LakebaseDatabaseCatalog>>(apiResponseResult.Errors);
            }

            DatabricksDatabaseCatalogResponse? apiResponse = apiResponseResult.ValueOrDefault;
            if (apiResponse == null)
            {
                _logger.LogWarning("No catalog response returned for catalogName {catalogName}", catalogName);
                return Result.Ok(new List<LakebaseDatabaseCatalog>());
            }

            List<LakebaseDatabaseCatalog> result = [
                new LakebaseDatabaseCatalog
                {
                    Name = apiResponse.Name,
                    DatabaseInstanceName = apiResponse.DatabaseInstanceName,
                    DatabaseName = apiResponse.DatabaseName,
                    Uid = apiResponse.Uid,
                }
            ];

            _logger.LogInformation("Retrieved Lakebase database catalog for catalogName {catalogName}", catalogName);
            return Result.Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks database catalog API for catalogName {catalogName}", catalogName);
            return Result.Fail<List<LakebaseDatabaseCatalog>>("Failed to communicate with Databricks API");
        }
    }

    private sealed class LakebaseAutoscalingConnectionContext
    {
        public string ProjectId { get; set; } = string.Empty;
        public string BranchId { get; set; } = string.Empty;
        public string DatabaseId { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public string EndpointId { get; set; } = string.Empty;
        public string Host { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    private sealed class LakebaseAutoscalingBranchConnectionContext
    {
        public string EndpointId { get; set; } = string.Empty;
        public string Host { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    private sealed class DatabricksDatabaseCredentialResponse
    {
        [JsonPropertyName("token")]
        public string? Token { get; set; }
    }

    private sealed class DatabricksCurrentUserResponse
    {
        [JsonPropertyName("userName")]
        public string? UserName { get; set; }

        [JsonPropertyName("emails")]
        public List<DatabricksCurrentUserEmail>? Emails { get; set; }
    }

    private sealed class DatabricksCurrentUserEmail
    {
        [JsonPropertyName("value")]
        public string? Value { get; set; }
    }

    private sealed class DatabricksDatabaseInstancesResponse
    {
        [JsonPropertyName("database_instances")]
        public List<DatabricksDatabaseInstanceInfo>? DatabaseInstances { get; set; }

        [JsonPropertyName("next_page_token")]
        public string? NextPageToken { get; set; }
    }

    private sealed class DatabricksDatabaseInstanceInfo
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("read_write_dns")]
        public string? ReadWriteDns { get; set; }

        [JsonPropertyName("database_name")]
        public string? DatabaseName { get; set; }
    }

    private sealed class DatabricksDatabaseCatalogResponse
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("database_instance_name")]
        public string? DatabaseInstanceName { get; set; }

        [JsonPropertyName("database_name")]
        public string? DatabaseName { get; set; }

        [JsonPropertyName("uid")]
        public string? Uid { get; set; }
    }
}
