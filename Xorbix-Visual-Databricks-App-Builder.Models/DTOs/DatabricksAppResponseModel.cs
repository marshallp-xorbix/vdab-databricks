using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models
{
    public class DatabricksAppResponse
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("description")]
        public string Description { get; set; } = string.Empty;

        [JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [JsonPropertyName("creator")]
        public string Creator { get; set; } = string.Empty;

        [JsonPropertyName("updater")]
        public string Updater { get; set; } = string.Empty;

        [JsonPropertyName("create_time")]
        public string CreateTime { get; set; } = string.Empty;

        [JsonPropertyName("update_time")]
        public string UpdateTime { get; set; } = string.Empty;

        [JsonPropertyName("compute_size")]
        public string ComputeSize { get; set; } = string.Empty;

        [JsonPropertyName("service_principal_id")]
        public long ServicePrincipalId { get; set; }

        [JsonPropertyName("service_principal_name")]
        public string ServicePrincipalName { get; set; } = string.Empty;

        [JsonPropertyName("service_principal_client_id")]
        public string ServicePrincipalClientId { get; set; } = string.Empty;

        [JsonPropertyName("resources")]
        public List<DatabricksAppResource> Resources { get; set; } = new();

        /// <summary>
        /// Normalized App Settings (resources, compute size, warnings).
        /// </summary>
        [JsonPropertyName("appSettings")]
        public AppSettingsDetailsDto AppSettings { get; set; } = new();

        [JsonPropertyName("active_deployment")]
        public DatabricksAppDeployment? ActiveDeployment { get; set; }

        [JsonPropertyName("app_status")]
        public DatabricksAppStatus? AppStatus { get; set; }
        
        [JsonPropertyName("compute_status")]
        public DatabricksAppStatus? ComputeStatus { get; set; }
    }

    public class DatabricksAppResource
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("description")]
        public string Description { get; set; } = string.Empty;

        [JsonPropertyName("sql_warehouse")]
        public SqlWarehouseResource? SqlWarehouse { get; set; }

        [JsonPropertyName("job")]
        public JobResource? Job { get; set; }

        [JsonPropertyName("database")]
        public DatabaseResource? Database { get; set; }

        /// <summary>
        /// Lakebase Autoscaling (Postgres) app resource; wire key <c>postgres</c>.
        /// </summary>
        [JsonPropertyName("postgres")]
        public PostgresAppResource? Postgres { get; set; }
        
        [JsonPropertyName("secret")]
        public SecretResource? Secret { get; set; }

        [JsonPropertyName("experiment")]
        public ExperimentResource? Experiment { get; set; }

        [JsonPropertyName("genie_space")]
        public GenieSpaceResource? GenieSpace { get; set; }

        [JsonPropertyName("serving_endpoint")]
        public ServingEndpointResource? ServingEndpoint { get; set; }

        [JsonPropertyName("uc_securable")]
        public UcSecurableResource? UcSecurable { get; set; }
    }

    public class SqlWarehouseResource
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    public class JobResource
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    public class DatabaseResource
    {
        [JsonPropertyName("database_name")]
        public string DatabaseName { get; set; } = string.Empty;

        [JsonPropertyName("database_display_name")]
        public string DatabaseDisplayName { get; set; } = string.Empty;

        [JsonPropertyName("instance_name")]
        public string InstanceName { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    /// <summary>
    /// Databricks Apps Lakebase Postgres resource; <c>database</c> must be
    /// <c>projects/.../branches/.../databases/{database_id}</c> (not <c>.../catalogs/...</c>).
    /// </summary>
    public class PostgresAppResource
    {
        [JsonPropertyName("branch")]
        public string Branch { get; set; } = string.Empty;

        [JsonPropertyName("database")]
        public string Database { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    public class SecretResource
    {
        [JsonPropertyName("key")]
        public string Key { get; set; } = string.Empty;

        [JsonPropertyName("scope")]
        public string Scope { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    public class ExperimentResource
    {
        [JsonPropertyName("experiment_id")]
        public string ExperimentId { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    public class GenieSpaceResource
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("space_id")]
        public string SpaceId { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    public class ServingEndpointResource
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    public class UcSecurableResource
    {
        [JsonPropertyName("securable_full_name")]
        public string SecurableFullName { get; set; } = string.Empty;
        
        [JsonPropertyName("securable_type")]
        public string SecurableType { get; set; } = string.Empty;

        [JsonPropertyName("permission")]
        public string Permission { get; set; } = string.Empty;
    }

    public class DatabricksAppDeployment
    {
        [JsonPropertyName("deployment_id")]
        public string DeploymentId { get; set; } = string.Empty;

        [JsonPropertyName("mode")]
        public string Mode { get; set; } = string.Empty;
        
        [JsonPropertyName("status")]
        public DatabricksAppStatus? Status { get; set; }
    }

    public class DatabricksAppStatus
    {
        [JsonPropertyName("state")]
        public string State { get; set; } = string.Empty;

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;
    }
}
