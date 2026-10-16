using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models
{
    public class AppDeploymentStatus
    {
        [JsonPropertyName("state")]
        public string State { get; set; } = string.Empty;

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;
    }
}
