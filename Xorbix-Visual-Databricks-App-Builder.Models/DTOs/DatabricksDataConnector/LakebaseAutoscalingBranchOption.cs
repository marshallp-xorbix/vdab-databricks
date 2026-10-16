namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

public class LakebaseAutoscalingBranchOption
{
    public string BranchName { get; set; } = string.Empty;
    public string BranchId { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public List<LakebaseAutoscalingEndpointOption> Endpoints { get; set; } = [];
}
