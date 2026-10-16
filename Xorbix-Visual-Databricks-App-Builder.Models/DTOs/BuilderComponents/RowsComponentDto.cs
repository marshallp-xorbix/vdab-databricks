namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class RowsProps
{
    public int? RowCount { get; set; }
}

public class RowsComponentDto : VdabComponentDto
{
    public required RowsProps Props { get; set; }
}
