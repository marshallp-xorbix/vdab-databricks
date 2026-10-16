namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class BarChartProps
{
    public string? Title { get; set; }

    public string? SeriesColor { get; set; }

    public ChartAxisConfigDto XAxis { get; set; } = new();

    public ChartAxisConfigDto YAxis { get; set; } = new();
}

public class BarChartComponentDto : VdabComponentDto
{
    public required BarChartProps Props { get; set; }
}
