namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Props for the Heat Map Story visualization (geographic intensity choropleth).
/// </summary>
public class HeatMapStoryProps
{
    public string? Title { get; set; }

    public ChartAxisConfigDto GeographicArea { get; set; } = new();

    public ChartAxisConfigDto MetricValue { get; set; } = new();

    public ChartAxisConfigDto TimeField { get; set; } = new();

    public ChartAxisConfigDto SecondaryMetric { get; set; } = new();

    public ChartAxisConfigDto ChangePct { get; set; } = new();

    public ChartAxisConfigDto TargetValue { get; set; } = new();

    public ChartAxisConfigDto RiskScore { get; set; } = new();

    public ChartAxisConfigDto Category { get; set; } = new();

    public ChartAxisConfigDto ForecastValue { get; set; } = new();

    public ChartAxisConfigDto Notes { get; set; } = new();

    /// <summary>usa | canada | europe | global | custom — MVP supports usa only.</summary>
    public string MapScope { get; set; } = "usa";

    /// <summary>state | country | province | county | custom — MVP supports state only.</summary>
    public string GeographicLevel { get; set; } = "state";

    /// <summary>sequential | diverging</summary>
    public string ColorScale { get; set; } = "sequential";

    public bool ShowLabels { get; set; } = true;

    public bool ShowLegend { get; set; } = true;

    /// <summary>sum | avg | max | min — used when MetricValue.Transform is none</summary>
    public string AggregationMethod { get; set; } = "sum";
}

/// <summary>
/// Heat Map Story visualization component DTO.
/// </summary>
public class HeatMapStoryComponentDto : VdabComponentDto
{
    public required HeatMapStoryProps Props { get; set; }
}
