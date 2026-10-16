using System.ComponentModel.DataAnnotations;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Models
{
    public class StreamlitUploadRequest
    {
        [Range(1, int.MaxValue, ErrorMessage = "Workspace connection ID is required.")]
        public int WorkspaceConnectionId { get; set; }
        public string WorkspaceUrl { get; set; } = string.Empty;
        public string AccessToken { get; set; } = string.Empty;
        public string TargetPath { get; set; } = string.Empty;
        public string AppName { get; set; } = string.Empty;
        public List<VdabComponentDto> FormComponents { get; set; } = new();
        public StreamlitThemeConfig? ThemeConfig { get; set; } = new();
        public WorkflowDefinitionDto WorkflowDefinition { get; set; } = new();

        /// <summary>
        /// User-editable <c>custom_modules.py</c> content to upload with the app bundle.
        /// </summary>
        public string? CustomModulesCode { get; set; }

        /// <summary>
        /// Databricks Apps resource key for <c>DATABRICKS_WAREHOUSE_ID</c> in <c>app.yaml</c>.
        /// When null/empty, defaults to <see cref="DatabricksAppsSqlWarehouseResource.DefaultResourceKey"/>.
        /// </summary>
        public string? SqlWarehouseResourceKey { get; set; }
    }

    public class StreamlitUploadResult
    {
        public bool Success { get; set; }
        public string UploadPath { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? ErrorDetails { get; set; }
    }
}
