using System.Text.Json;
using System.Text.Json.Serialization;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class AppSettingsDetailsMapperTests
{
    private static readonly JsonSerializerOptions SnakeCaseOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    [Fact]
    public void MapFromRoot_MapsPostgresAutoscalingResource_ToNormalizedAutoscalingDatabase()
    {
        string json = """
            {
              "compute_size": "Small",
              "resources": [
                {
                  "name": "autoscaling-db",
                  "description": "Autoscaling postgres resource",
                  "postgres": {
                    "branch": "projects/project-a/branches/br-main",
                    "database": "projects/project-a/branches/br-main/catalogs/databricks_postgres",
                    "permission": "CAN_CONNECT_AND_CREATE"
                  }
                }
              ]
            }
            """;

        using JsonDocument document = JsonDocument.Parse(json);

        AppSettingsDetailsDto result = AppSettingsDetailsMapper.MapFromRoot(document.RootElement, SnakeCaseOptions);

        NormalizedAppResourceDto resource = Assert.Single(result.Resources);
        Assert.Equal(DatabricksAppResourceKinds.AutoscalingDatabase, resource.Kind);
        Assert.Equal("autoscaling-db", resource.Name);
        Assert.Equal("project-a/br-main", resource.Database?.InstanceName);
        Assert.Equal("databricks_postgres", resource.Database?.DatabaseName);
        Assert.Equal("CAN_CONNECT_AND_CREATE", resource.Database?.Permission);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void MapFromRoot_KeepsDatabaseKind_WhenResourceUsesGenericDatabaseKey_WithBranchLikeInstance()
    {
        string json = """
            {
              "resources": [
                {
                  "name": "autoscaling-db",
                  "database": {
                    "database_name": "logical_db",
                    "instance_name": "project-a/br-main",
                    "permission": "CAN_CONNECT_AND_CREATE"
                  }
                }
              ]
            }
            """;

        using JsonDocument document = JsonDocument.Parse(json);

        AppSettingsDetailsDto result = AppSettingsDetailsMapper.MapFromRoot(document.RootElement, SnakeCaseOptions);

        NormalizedAppResourceDto resource = Assert.Single(result.Resources);
        Assert.Equal(DatabricksAppResourceKinds.Database, resource.Kind);
        Assert.Equal("logical_db", resource.Database?.DatabaseName);
        Assert.Equal("project-a/br-main", resource.Database?.InstanceName);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void MapFromRoot_KeepsDatabaseKind_WhenDatabaseNameLooksLikeEndpoint()
    {
        JsonElement root = JsonDocument.Parse(
            """
            {
              "resources": [
                {
                  "name": "autoscaling-lakebase",
                  "description": "",
                  "database": {
                    "database_name": "ep-aged-rice-d20d8hbt",
                    "instance_name": "vdab-autoscale-lakebase",
                    "permission": "CAN_CONNECT_AND_CREATE"
                  }
                }
              ]
            }
            """).RootElement.Clone();

        JsonSerializerOptions options = new(JsonSerializerDefaults.Web);
        var mapped = AppSettingsDetailsMapper.MapFromRoot(root, options);

        Assert.Single(mapped.Resources);
        Assert.Equal(DatabricksAppResourceKinds.Database, mapped.Resources[0].Kind);
    }

    [Fact]
    public void MapFromRoot_KeepsDatabaseKind_WhenDatabaseNameMatchesExampleCatalogShortName()
    {
        JsonElement root = JsonDocument.Parse(
            """
            {
              "resources": [
                {
                  "name": "autoscaling-lakebase",
                  "description": "",
                  "database": {
                    "database_name": "databricks_postgres",
                    "instance_name": "vdab-autoscale-lakebase",
                    "permission": "CAN_CONNECT_AND_CREATE"
                  }
                }
              ]
            }
            """).RootElement.Clone();

        JsonSerializerOptions options = new(JsonSerializerDefaults.Web);
        var mapped = AppSettingsDetailsMapper.MapFromRoot(root, options);

        Assert.Single(mapped.Resources);
        Assert.Equal(DatabricksAppResourceKinds.Database, mapped.Resources[0].Kind);
    }

    [Fact]
    public void MapFromRoot_MapsPostgresDatabaseCatalogsPath_ToShortName_ForInboundCompat()
    {
        JsonElement root = JsonDocument.Parse(
            """
            {
              "resources": [
                {
                  "name": "postgres",
                  "description": "",
                  "postgres": {
                    "branch": "projects/p/branches/br-main",
                    "database": "projects/p/branches/br-main/catalogs/databricks_postgres",
                    "permission": "CAN_CONNECT_AND_CREATE"
                  }
                }
              ]
            }
            """).RootElement.Clone();

        JsonSerializerOptions options = new(JsonSerializerDefaults.Web);
        var mapped = AppSettingsDetailsMapper.MapFromRoot(root, options);

        Assert.Single(mapped.Resources);
        Assert.Equal("databricks_postgres", mapped.Resources[0].Database?.DatabaseName);
    }

    [Fact]
    public void MapFromRoot_MapsPostgresWireKey_ToAutoscalingDatabase_WithoutUnknownTypeWarning()
    {
        JsonElement root = JsonDocument.Parse(
            """
            {
              "resources": [
                {
                  "name": "autoscaling-lakebase",
                  "description": "",
                  "postgres": {
                    "branch": "projects/vdab-autoscale-lakebase/branches/br-sweet-dew-d2sqihlr",
                    "database": "projects/vdab-autoscale-lakebase/branches/br-sweet-dew-d2sqihlr/databases/databricks_postgres",
                    "permission": "CAN_CONNECT_AND_CREATE"
                  }
                }
              ]
            }
            """).RootElement.Clone();

        JsonSerializerOptions options = new(JsonSerializerDefaults.Web);
        var mapped = AppSettingsDetailsMapper.MapFromRoot(root, options);

        Assert.Single(mapped.Resources);
        Assert.Equal(
            DatabricksAppResourceKinds.AutoscalingDatabase,
            mapped.Resources[0].Kind);
        Assert.Empty(mapped.Warnings);
        Assert.Equal(
            "vdab-autoscale-lakebase/br-sweet-dew-d2sqihlr",
            mapped.Resources[0].Database?.InstanceName);
        Assert.Equal("databricks_postgres", mapped.Resources[0].Database?.DatabaseName);
    }

    [Fact]
    public void MapFromRoot_MapsPostgresShortDatabaseField_ToShortDatabaseName()
    {
        JsonElement root = JsonDocument.Parse(
            """
            {
              "resources": [
                {
                  "name": "x",
                  "description": "",
                  "postgres": {
                    "branch": "projects/p/branches/br-main",
                    "database": "databricks_postgres",
                    "permission": "CAN_CONNECT_AND_CREATE"
                  }
                }
              ]
            }
            """).RootElement.Clone();

        JsonSerializerOptions options = new(JsonSerializerDefaults.Web);
        var mapped = AppSettingsDetailsMapper.MapFromRoot(root, options);

        Assert.Single(mapped.Resources);
        Assert.Equal("databricks_postgres", mapped.Resources[0].Database?.DatabaseName);
    }

    [Fact]
    public void MapFromRoot_MapsLegacyPostgresObjectWithoutBranch_ToDatabaseKind()
    {
        JsonElement root = JsonDocument.Parse(
            """
            {
              "resources": [
                {
                  "name": "legacy",
                  "description": "",
                  "postgres": {
                    "database_name": "databricks_postgres",
                    "instance_name": "vdab-autoscale-lakebase/br-sweet-dew-d2sqihlr",
                    "permission": "CAN_CONNECT_AND_CREATE"
                  }
                }
              ]
            }
            """).RootElement.Clone();

        JsonSerializerOptions options = new(JsonSerializerDefaults.Web);
        var mapped = AppSettingsDetailsMapper.MapFromRoot(root, options);

        Assert.Single(mapped.Resources);
        Assert.Equal(DatabricksAppResourceKinds.Database, mapped.Resources[0].Kind);
    }

    [Fact]
    public void MapFromRoot_ClassifiesDatabaseAsProvisioned_WhenInstanceNameIsMissing()
    {
        JsonElement root = JsonDocument.Parse(
            """
            {
              "resources": [
                {
                  "name": "provisioned-db",
                  "database": {
                    "database_name": "app_db",
                    "instance_name": "",
                    "permission": "CAN_USE"
                  }
                }
              ]
            }
            """).RootElement.Clone();

        JsonSerializerOptions options = new(JsonSerializerDefaults.Web);
        var mapped = AppSettingsDetailsMapper.MapFromRoot(root, options);

        Assert.Single(mapped.Resources);
        Assert.Equal(
            DatabricksAppResourceKinds.Database,
            mapped.Resources[0].Kind);
    }
}
