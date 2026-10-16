using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models
{
    public class DatabricksAppDeploymentResponse
    {
        [JsonPropertyName("deployment_id")]
        public string DeploymentId { get; set; } = string.Empty;

        [JsonPropertyName("app_id")]
        public string AppId { get; set; } = string.Empty;

        [JsonPropertyName("mode")]
        public string Mode { get; set; } = string.Empty;

        [JsonPropertyName("source_code_path")]
        public string SourceCodePath { get; set; } = string.Empty;

        [JsonPropertyName("status")]
        public AppDeploymentStatus Status { get; set; } = new();
    }
}
