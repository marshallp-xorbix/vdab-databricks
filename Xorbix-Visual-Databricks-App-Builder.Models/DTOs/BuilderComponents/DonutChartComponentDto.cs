namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class DonutChartProps
{
    public string? Title { get; set; }

    public string? SeriesColor { get; set; }

    public ChartAxisConfigDto Category { get; set; } = new();

    public ChartAxisConfigDto Value { get; set; } = new();
}

public class DonutChartComponentDto : VdabComponentDto
{
    public required DonutChartProps Props { get; set; }
}
