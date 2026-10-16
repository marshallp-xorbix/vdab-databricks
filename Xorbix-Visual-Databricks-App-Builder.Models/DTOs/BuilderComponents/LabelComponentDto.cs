namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class LabelProps
{
    public string? Text { get; set; }
    public string? FontSize { get; set; } = "medium"; // small, medium, large
    public bool Bold { get; set; } = false;
}

public class LabelComponentDto : VdabComponentDto
{
    public required LabelProps Props { get; set; }
}
