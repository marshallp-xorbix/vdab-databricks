namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

/// <summary>
/// Read-only selector payload for Lakebase Autoscaling resources.
/// </summary>
public class LakebaseAutoscalingSelectorResponse
{
    public List<LakebaseAutoscalingProjectOption> Projects { get; set; } = [];
}
