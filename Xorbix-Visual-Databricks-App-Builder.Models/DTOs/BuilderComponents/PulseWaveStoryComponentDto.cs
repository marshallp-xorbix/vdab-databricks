namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Props for the Pulse Wave Story visualization (performance rhythm over time).
/// </summary>
public class PulseWaveStoryProps
{
    public string? Title { get; set; }

    /// <summary>Business label for the metric (not a column mapping).</summary>
    public string MetricName { get; set; } = "Metric";

    public ChartAxisConfigDto TimeField { get; set; } = new();

    public ChartAxisConfigDto MetricValue { get; set; } = new();

    public ChartAxisConfigDto BaselineValue { get; set; } = new();

    public ChartAxisConfigDto EventName { get; set; } = new();

    public ChartAxisConfigDto EventType { get; set; } = new();

    public ChartAxisConfigDto ImpactScore { get; set; } = new();

    /// <summary>sum | avg | max | min — used when MetricValue.Transform is none</summary>
    public string AggregationMethod { get; set; } = "sum";

    public bool ShowBaseline { get; set; } = true;

    public bool ShowEvents { get; set; } = true;

    public bool ShowAnomalyMarkers { get; set; } = true;

    public bool FillUnderWave { get; set; } = true;
}

/// <summary>
/// Pulse Wave Story visualization component DTO.
/// </summary>
public class PulseWaveStoryComponentDto : VdabComponentDto
{
    public required PulseWaveStoryProps Props { get; set; }
}
