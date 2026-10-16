namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class TabsProps
{
    public required List<string> Tabs { get; set; }
    public int? DefaultTabIndex { get; set; }
}

public class TabsComponentDto : VdabComponentDto
{
    public required TabsProps Props { get; set; }
}
