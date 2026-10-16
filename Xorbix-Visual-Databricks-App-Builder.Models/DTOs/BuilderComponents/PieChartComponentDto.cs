namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class PieChartProps
{
    public string? Title { get; set; }

    public string? SeriesColor { get; set; }

    /// <summary>Slice / category dimension.</summary>
    public ChartAxisConfigDto Category { get; set; } = new();

    /// <summary>Angular measure (numeric).</summary>
    public ChartAxisConfigDto Value { get; set; } = new();
}

public class PieChartComponentDto : VdabComponentDto
{
    public required PieChartProps Props { get; set; }
}
