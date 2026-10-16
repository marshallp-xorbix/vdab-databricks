namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.DatabricksDataConnector;

public class LakebaseAutoscalingProjectOption
{
    public string ProjectName { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public List<LakebaseAutoscalingBranchOption> Branches { get; set; } = [];
}
