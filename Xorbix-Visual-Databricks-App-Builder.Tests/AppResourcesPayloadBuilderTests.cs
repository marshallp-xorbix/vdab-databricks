using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class AppResourcesPayloadBuilderTests
{
    [Fact]
    public void BuildAndValidate_Succeeds_ForValidJobResource()
    {
        List<NormalizedAppResourceDto> resources = new()
        {
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.Job,
                Name = "my-job-res",
                Description = "",
                Job = new JobResource { Id = "123", Permission = "CAN_MANAGE" }
            }
        };

        Result<List<DatabricksAppResource>> result = AppResourcesPayloadBuilder.BuildAndValidate(resources);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value);
        Assert.Equal("my-job-res", result.Value[0].Name);
        Assert.Equal("123", result.Value[0].Job?.Id);
    }

    [Fact]
    public void BuildAndValidate_Succeeds_ForValidAutoscalingLakebaseResource()
    {
        List<NormalizedAppResourceDto> resources = new()
        {
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.AutoscalingDatabase,
                Name = "autoscaling-db-res",
                Description = "",
                Database = new DatabaseResource
                {
                    DatabaseName = "default-rw",
                    InstanceName = "vdab-autoscale-lakebase/br-sweet-dew-d2sqihlr",
                    Permission = "CAN_CONNECT_AND_CREATE"
                }
            }
        };

        Result<List<DatabricksAppResource>> result = AppResourcesPayloadBuilder.BuildAndValidate(resources);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value);
        Assert.Null(result.Value[0].Database);
        Assert.Equal(
            "projects/vdab-autoscale-lakebase/branches/br-sweet-dew-d2sqihlr/databases/default-rw",
            result.Value[0].Postgres?.Database);
        Assert.Equal(
            "projects/vdab-autoscale-lakebase/branches/br-sweet-dew-d2sqihlr",
            result.Value[0].Postgres?.Branch);
    }

    [Fact]
    public void BuildAndValidate_Succeeds_ForAutoscalingLakebase_NormalizesCatalogsStyleDatabaseFieldToDatabasesPath()
    {
        List<NormalizedAppResourceDto> resources = new()
        {
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.AutoscalingDatabase,
                Name = "postgres",
                Description = "",
                Database = new DatabaseResource
                {
                    DatabaseName =
                        "projects/p/branches/br-main/catalogs/databricks_postgres",
                    InstanceName = "vdab-autoscale-lakebase/br-sweet-dew-d2sqihlr",
                    Permission = "CAN_CONNECT_AND_CREATE"
                }
            }
        };

        Result<List<DatabricksAppResource>> result = AppResourcesPayloadBuilder.BuildAndValidate(resources);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value);
        Assert.Equal(
            "projects/vdab-autoscale-lakebase/branches/br-sweet-dew-d2sqihlr/databases/databricks_postgres",
            result.Value[0].Postgres?.Database);
    }

    [Fact]
    public void BuildAndValidate_Succeeds_ForAutoscalingLakebaseDatabricksPostgres_UsesDatabasesPath()
    {
        List<NormalizedAppResourceDto> resources = new()
        {
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.AutoscalingDatabase,
                Name = "autoscaling-db-res",
                Description = "",
                Database = new DatabaseResource
                {
                    DatabaseName = "databricks_postgres",
                    InstanceName = "vdab-autoscale-lakebase/br-sweet-dew-d2sqihlr",
                    Permission = "CAN_CONNECT_AND_CREATE"
                }
            }
        };

        Result<List<DatabricksAppResource>> result = AppResourcesPayloadBuilder.BuildAndValidate(resources);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value);
        Assert.Equal(
            "projects/vdab-autoscale-lakebase/branches/br-sweet-dew-d2sqihlr/databases/databricks_postgres",
            result.Value[0].Postgres?.Database);
    }

    [Fact]
    public void BuildAndValidate_Fails_ForAutoscalingLakebaseResource_WhenInstanceNameIsNotProjectAndBranch()
    {
        List<NormalizedAppResourceDto> resources = new()
        {
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.AutoscalingDatabase,
                Name = "autoscaling-db-res",
                Description = "",
                Database = new DatabaseResource
                {
                    DatabaseName = "databricks_postgres",
                    InstanceName = "vdab-autoscale-lakebase",
                    Permission = "CAN_CONNECT_AND_CREATE"
                }
            }
        };

        Result<List<DatabricksAppResource>> result = AppResourcesPayloadBuilder.BuildAndValidate(resources);

        Assert.True(result.IsFailed);
        Assert.Contains(
            result.Errors,
            error => error.Message.Contains("instance_name must be project_id/branch_uid", StringComparison.Ordinal));
    }

    [Fact]
    public void BuildAndValidate_Succeeds_ForValidProvisionedDatabaseResource_UsesDatabaseWireKey()
    {
        List<NormalizedAppResourceDto> resources = new()
        {
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.Database,
                Name = "provisioned-db",
                Description = "",
                Database = new DatabaseResource
                {
                    DatabaseName = "my_catalog",
                    InstanceName = "inst",
                    Permission = "CAN_CONNECT_AND_CREATE"
                }
            }
        };

        Result<List<DatabricksAppResource>> result = AppResourcesPayloadBuilder.BuildAndValidate(resources);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value);
        Assert.Null(result.Value[0].Postgres);
        Assert.Equal("my_catalog", result.Value[0].Database?.DatabaseName);
    }

    [Fact]
    public void BuildAndValidate_Fails_OnDuplicateResourceKeys()
    {
        List<NormalizedAppResourceDto> resources = new()
        {
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.Job,
                Name = "dup",
                Job = new JobResource { Id = "1", Permission = "CAN_VIEW" }
            },
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.Job,
                Name = "dup",
                Job = new JobResource { Id = "2", Permission = "CAN_VIEW" }
            }
        };

        Result<List<DatabricksAppResource>> result = AppResourcesPayloadBuilder.BuildAndValidate(resources);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, e => e.Message.Contains("Duplicate resource key", StringComparison.Ordinal));
    }

    [Fact]
    public void BuildAndValidate_Fails_WhenKindMissing()
    {
        List<NormalizedAppResourceDto> resources = new()
        {
            new NormalizedAppResourceDto
            {
                Kind = "",
                Name = "x",
                Job = new JobResource { Id = "1", Permission = "CAN_VIEW" }
            }
        };

        Result<List<DatabricksAppResource>> result = AppResourcesPayloadBuilder.BuildAndValidate(resources);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, e => e.Message.Contains("Kind is required", StringComparison.Ordinal));
    }
}
