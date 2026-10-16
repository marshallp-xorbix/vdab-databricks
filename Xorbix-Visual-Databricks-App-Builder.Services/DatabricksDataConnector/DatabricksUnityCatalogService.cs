using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksUnityCatalogService : IDatabricksUnityCatalogService
{
    private readonly IDatabricksApiService _databricksApi;
    private readonly IDatabricksWorkspaceConnectionResolver _workspaceResolver;
    private readonly ILogger<DatabricksUnityCatalogService> _logger;

    public DatabricksUnityCatalogService(
        IDatabricksApiService databricksApi,
        IDatabricksWorkspaceConnectionResolver workspaceResolver,
        ILogger<DatabricksUnityCatalogService> logger)
    {
        _databricksApi = databricksApi;
        _workspaceResolver = workspaceResolver;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<List<UnityCatalogTable>>> GetUnityCatalogTablesAsync(Guid userId, int workspaceConnectionId, string? catalog = null, string? schema = null)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<UnityCatalogTable>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Unity Catalog tables for workspace: {workspaceUrl}, catalog: {catalog}, schema: {schema}", workspaceUrl, catalog, schema);

            if (!string.IsNullOrEmpty(catalog) && !string.IsNullOrEmpty(schema))
            {
                return await GetTablesFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, catalog, schema);
            }

            Result<List<string>> catalogsResult = await GetCatalogsFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl);
            if (catalogsResult.IsFailed)
            {
                return catalogsResult.ToResult<List<UnityCatalogTable>>();
            }

            List<UnityCatalogTable> allTables = new();

            foreach (string catalogName in catalogsResult.ValueOrDefault)
            {
                Result<List<string>> schemasResult = await GetSchemasFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, catalogName);
                if (schemasResult.IsFailed)
                {
                    _logger.LogWarning("Failed to get schemas for catalog {catalog}, skipping", catalogName);
                    continue;
                }

                foreach (string schemaName in schemasResult.ValueOrDefault)
                {
                    Result<List<UnityCatalogTable>> tablesResult =
                        await GetTablesFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, catalogName, schemaName);
                    if (tablesResult.IsFailed)
                    {
                        _logger.LogWarning("Failed to get tables for catalog {catalog}.{schema}, skipping", catalogName, schemaName);
                        continue;
                    }

                    allTables.AddRange(tablesResult.ValueOrDefault);
                }
            }

            _logger.LogInformation("Retrieved {count} Unity Catalog tables across {catalogCount} catalogs",
                allTables.Count, catalogsResult.ValueOrDefault.Count);

            return Result.Ok(allTables);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Unity Catalog tables for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<UnityCatalogTable>>("Failed to retrieve Unity Catalog tables");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<string>>> GetUnityCatalogCatalogsAsync(Guid userId, int workspaceConnectionId)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<string>>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Unity Catalog catalogs for workspace: {workspaceUrl}", workspaceUrl);

            Result<List<string>> catalogsResult = await GetCatalogsFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl);
            if (catalogsResult.IsFailed)
            {
                _logger.LogWarning("Catalogs API call failed: {errors}", string.Join(", ", catalogsResult.Errors.Select(e => e.Message)));
            }

            return catalogsResult;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Unity Catalog catalogs for connection: {workspaceConnectionId}", workspaceConnectionId);
            return Result.Fail<List<string>>("Failed to retrieve Unity Catalog catalogs");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<string>>> GetUnityCatalogSchemasAsync(Guid userId, int workspaceConnectionId, string catalog)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<string>>();
            }

            if (string.IsNullOrEmpty(catalog))
            {
                return Result.Fail<List<string>>("Catalog name is required");
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Unity Catalog schemas for workspace: {workspaceUrl}, catalog: {catalog}", workspaceUrl, catalog);

            Result<List<string>> schemasResult = await GetSchemasFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, catalog);
            if (schemasResult.IsFailed)
            {
                _logger.LogWarning("Schemas API call failed: {errors}", string.Join(", ", schemasResult.Errors.Select(e => e.Message)));
            }

            return schemasResult;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Unity Catalog schemas for connection: {workspaceConnectionId}, catalog: {catalog}", workspaceConnectionId, catalog);
            return Result.Fail<List<string>>("Failed to retrieve Unity Catalog schemas");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<string>>> GetUnityCatalogVolumesAsync(Guid userId, int workspaceConnectionId, string catalog, string schema)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<List<string>>();
            }

            if (string.IsNullOrEmpty(catalog))
            {
                return Result.Fail<List<string>>("Catalog name is required");
            }

            if (string.IsNullOrEmpty(schema))
            {
                return Result.Fail<List<string>>("Schema name is required");
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Unity Catalog volumes for workspace: {workspaceUrl}, catalog: {catalog}, schema: {schema}", workspaceUrl, catalog, schema);

            Result<List<string>> volumesResult = await GetVolumesFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, catalog, schema);
            if (volumesResult.IsFailed)
            {
                _logger.LogWarning("Volumes API call failed: {errors}", string.Join(", ", volumesResult.Errors.Select(e => e.Message)));
            }

            return volumesResult;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Unity Catalog volumes for connection: {workspaceConnectionId}, catalog: {catalog}, schema: {schema}", workspaceConnectionId, catalog, schema);
            return Result.Fail<List<string>>("Failed to retrieve Unity Catalog volumes");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<UnityCatalogTableDetails>> GetUnityCatalogTableDetailsAsync(Guid userId, int workspaceConnectionId, string catalog, string schema, string table)
    {
        try
        {
            Result<string> workspaceUrlResult = await _workspaceResolver.ResolveWorkspaceUrlAsync(workspaceConnectionId);
            if (workspaceUrlResult.IsFailed)
            {
                return workspaceUrlResult.ToResult<UnityCatalogTableDetails>();
            }

            string workspaceUrl = workspaceUrlResult.ValueOrDefault;
            _logger.LogInformation("Getting Unity Catalog table details for {catalog}.{schema}.{table}", catalog, schema, table);

            return await GetTableDetailsFromDatabricksAsync(userId, workspaceConnectionId, workspaceUrl, catalog, schema, table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Unity Catalog table details for {catalog}.{schema}.{table}", catalog, schema, table);
            return Result.Fail<UnityCatalogTableDetails>("Failed to retrieve Unity Catalog table details");
        }
    }

    private async Task<Result<List<string>>> GetCatalogsFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl)
    {
        try
        {
            string apiUrl = DatabricksApiRoutes.UnityCatalogCatalogsPath;
            _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

            Result<DatabricksCatalogsResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksCatalogsResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<string>>(apiResponseResult.Errors);
            }

            DatabricksCatalogsResponse? apiResponse = apiResponseResult.ValueOrDefault;
            if (apiResponse?.Catalogs == null)
            {
                _logger.LogWarning("No catalogs found in Unity Catalog response");
                return Result.Ok(new List<string>());
            }

            List<string> catalogs = apiResponse.Catalogs.Where(c => c.Name != null).Select(c => c.Name!).ToList();
            _logger.LogInformation("Retrieved {count} Unity Catalog catalogs", catalogs.Count);
            return Result.Ok(catalogs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks Unity Catalog catalogs API");
            return Result.Fail<List<string>>("Failed to communicate with Databricks API");
        }
    }

    private async Task<Result<List<string>>> GetSchemasFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl, string catalog)
    {
        try
        {
            string apiUrl = DatabricksApiRoutes.UnityCatalogSchemasPath(Uri.EscapeDataString(catalog));
            _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

            Result<DatabricksSchemasResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksSchemasResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<string>>(apiResponseResult.Errors);
            }

            DatabricksSchemasResponse? apiResponse = apiResponseResult.ValueOrDefault;
            if (apiResponse?.Schemas == null)
            {
                _logger.LogWarning("No schemas found for catalog {catalog}", catalog);
                return Result.Ok(new List<string>());
            }

            List<string> schemas = apiResponse.Schemas.Where(s => s.Name != null).Select(s => s.Name!).ToList();
            _logger.LogInformation("Retrieved {count} schemas for catalog {catalog}", schemas.Count, catalog);
            return Result.Ok(schemas);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks Unity Catalog schemas API for catalog {catalog}", catalog);
            return Result.Fail<List<string>>("Failed to communicate with Databricks API");
        }
    }

    private async Task<Result<List<UnityCatalogTable>>> GetTablesFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl, string catalog, string schema)
    {
        try
        {
            string apiUrl = DatabricksApiRoutes.UnityCatalogTablesPath(
                Uri.EscapeDataString(catalog),
                Uri.EscapeDataString(schema));
            _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

            Result<DatabricksTablesResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksTablesResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<UnityCatalogTable>>(apiResponseResult.Errors);
            }

            DatabricksTablesResponse? apiResponse = apiResponseResult.ValueOrDefault;
            if (apiResponse?.Tables == null)
            {
                _logger.LogWarning("No tables found for catalog {catalog}.{schema}", catalog, schema);
                return Result.Ok(new List<UnityCatalogTable>());
            }

            List<UnityCatalogTable> tables = apiResponse.Tables.Select(table => new UnityCatalogTable
            {
                Catalog = table.CatalogName,
                Schema = table.SchemaName,
                Table = table.Name,
                FullName = $"{table.CatalogName}.{table.SchemaName}.{table.Name}"
            }).ToList();

            _logger.LogInformation("Retrieved {count} tables for catalog {catalog}.{schema}", tables.Count, catalog, schema);
            return Result.Ok(tables);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks Unity Catalog tables API for {catalog}.{schema}", catalog, schema);
            return Result.Fail<List<UnityCatalogTable>>("Failed to communicate with Databricks API");
        }
    }

    private async Task<Result<List<string>>> GetVolumesFromDatabricksAsync(Guid userId, int workspaceConnectionId, string workspaceUrl, string catalog, string schema)
    {
        try
        {
            string apiUrl = DatabricksApiRoutes.UnityCatalogVolumesPath(
                Uri.EscapeDataString(catalog),
                Uri.EscapeDataString(schema));
            _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

            Result<DatabricksVolumesResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksVolumesResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<List<string>>(apiResponseResult.Errors);
            }

            DatabricksVolumesResponse? apiResponse = apiResponseResult.ValueOrDefault;
            if (apiResponse?.Volumes == null)
            {
                _logger.LogWarning("No volumes found for catalog {catalog}.{schema}", catalog, schema);
                return Result.Ok(new List<string>());
            }

            List<string> volumes = apiResponse.Volumes.Select(v => v.Name).Where(n => !string.IsNullOrEmpty(n)).Select(n => n!).ToList();
            _logger.LogInformation("Retrieved {count} volumes for catalog {catalog}.{schema}", volumes.Count, catalog, schema);
            return Result.Ok(volumes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks Unity Catalog volumes API for {catalog}.{schema}", catalog, schema);
            return Result.Fail<List<string>>("Failed to communicate with Databricks API");
        }
    }

    private async Task<Result<UnityCatalogTableDetails>> GetTableDetailsFromDatabricksAsync(
        Guid userId,
        int workspaceConnectionId,
        string workspaceUrl,
        string catalog,
        string schema,
        string table)
    {
        try
        {
            string fullTableName = $"{catalog}.{schema}.{table}";
            string apiUrl = DatabricksApiRoutes.UnityCatalogTableByFullNamePath(Uri.EscapeDataString(fullTableName));
            _logger.LogInformation("Calling Databricks API: {apiUrl}", apiUrl);

            Result<DatabricksTableDetailsResponse> apiResponseResult =
                await _databricksApi.GetAsync<DatabricksTableDetailsResponse>(userId, workspaceConnectionId, workspaceUrl, apiUrl);
            if (apiResponseResult.IsFailed)
            {
                return Result.Fail<UnityCatalogTableDetails>(apiResponseResult.Errors);
            }

            DatabricksTableDetailsResponse? apiResponse = apiResponseResult.ValueOrDefault;
            if (apiResponse == null)
            {
                _logger.LogWarning("No table details found for {catalog}.{schema}.{table}", catalog, schema, table);
                return Result.Fail<UnityCatalogTableDetails>("Table details not found");
            }

            UnityCatalogTableDetails tableDetails = new()
            {
                CatalogName = apiResponse.CatalogName,
                SchemaName = apiResponse.SchemaName,
                Name = apiResponse.Name,
                FullName = $"{apiResponse.CatalogName}.{apiResponse.SchemaName}.{apiResponse.Name}",
                Columns = apiResponse.Columns?.Select(c => new UnityCatalogColumn
                {
                    Name = c.Name,
                    Type = c.Type,
                    Nullable = c.Nullable,
                    Comment = c.Comment
                }).ToList() ?? new List<UnityCatalogColumn>()
            };

            _logger.LogInformation("Retrieved table details with {count} columns for {catalog}.{schema}.{table}",
                tableDetails.Columns.Count, catalog, schema, table);
            return Result.Ok(tableDetails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Databricks Unity Catalog table details API for {catalog}.{schema}.{table}", catalog, schema, table);
            return Result.Fail<UnityCatalogTableDetails>("Failed to communicate with Databricks API");
        }
    }

    private sealed class DatabricksCatalogsResponse
    {
        public List<DatabricksCatalogInfo>? Catalogs { get; set; }
    }

    private sealed class DatabricksCatalogInfo
    {
        public string? Name { get; set; }
    }

    private sealed class DatabricksSchemasResponse
    {
        public List<DatabricksSchemaInfo>? Schemas { get; set; }
    }

    private sealed class DatabricksSchemaInfo
    {
        public string? Name { get; set; }
    }

    private sealed class DatabricksTablesResponse
    {
        public List<DatabricksTableInfo>? Tables { get; set; }
    }

    private sealed class DatabricksTableInfo
    {
        public string? CatalogName { get; set; }
        public string? SchemaName { get; set; }
        public string? Name { get; set; }
    }

    private sealed class DatabricksVolumesResponse
    {
        public List<DatabricksVolumeInfo>? Volumes { get; set; }
    }

    private sealed class DatabricksVolumeInfo
    {
        public string? Name { get; set; }
    }

    private sealed class DatabricksTableDetailsResponse
    {
        [JsonPropertyName("catalog_name")]
        public string? CatalogName { get; set; }

        [JsonPropertyName("schema_name")]
        public string? SchemaName { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("columns")]
        public List<DatabricksColumnInfo>? Columns { get; set; }
    }

    private sealed class DatabricksColumnInfo
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("type_name")]
        public string? Type { get; set; }

        [JsonPropertyName("nullable")]
        public bool? Nullable { get; set; }

        [JsonPropertyName("comment")]
        public string? Comment { get; set; }
    }
}
