namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class ExpanderProps
{
    public string? SectionTitle { get; set; }
    public bool DefaultExpanded { get; set; }
}

public class ExpanderComponentDto : VdabComponentDto
{
    public required ExpanderProps Props { get; set; }
}
