namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class EditableDataWindowProps
{
    public string? Label { get; set; }
    public int MaxRows { get; set; } = 5;
    public bool Scrollable { get; set; } = true;
    public string? Placeholder { get; set; } = null;
    public bool Disabled { get; set; } = false;
    public string NumRows { get; set; } = "fixed";
    public bool? HideIndex { get; set; } = null;
    public string Width { get; set; } = "stretch";
    public string Height { get; set; } = "auto";
}

public class EditableDataWindowComponentDto : VdabComponentDto
{
    public required EditableDataWindowProps Props { get; set; }
}

