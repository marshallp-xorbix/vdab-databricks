using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

/// <summary>
/// Standardized workflow route values.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/workflowRoutes.ts
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkflowRouteModel
{
    [JsonStringEnumMemberName("onSuccess")]
    OnSuccess,

    [JsonStringEnumMemberName("onError")]
    OnError,

    [JsonStringEnumMemberName("always")]
    Always
}