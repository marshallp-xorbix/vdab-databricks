namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class DataWindowProps
{
    public string? Label { get; set; }
    public int MaxRows { get; set; } = 5;
    public bool Scrollable { get; set; } = true;
    public string? Placeholder { get; set; } = null;
    public string Width { get; set; } = "stretch";
    public bool? HideIndex { get; set; } = null;
    public string Height { get; set; } = "auto";
}

public class DataWindowComponentDto : VdabComponentDto
{
    public required DataWindowProps Props { get; set; }
}
