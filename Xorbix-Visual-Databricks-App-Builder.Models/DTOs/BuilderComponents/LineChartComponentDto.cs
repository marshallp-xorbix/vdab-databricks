namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class LineChartProps
{
    public string? Title { get; set; }

    public string? SeriesColor { get; set; }

    public ChartAxisConfigDto XAxis { get; set; } = new();

    public ChartAxisConfigDto YAxis { get; set; } = new();
}

public class LineChartComponentDto : VdabComponentDto
{
    public required LineChartProps Props { get; set; }
}
