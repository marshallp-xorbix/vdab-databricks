namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class ColumnsProps
{
    public int? ColumnCount { get; set; }
}

public class ColumnsComponentDto : VdabComponentDto
{
    public required ColumnsProps Props { get; set; }
}
