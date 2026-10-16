namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Props for the Amoeba Story visualization (organic cluster/scatter of entities).
/// </summary>
public class AmoebaStoryProps
{
    public string? Title { get; set; }

    public ChartAxisConfigDto EntityId { get; set; } = new();

    public ChartAxisConfigDto EntityLabel { get; set; } = new();

    public ChartAxisConfigDto Category { get; set; } = new();

    public ChartAxisConfigDto SizeMetric { get; set; } = new();

    public ChartAxisConfigDto XMetric { get; set; } = new();

    public ChartAxisConfigDto YMetric { get; set; } = new();

    public ChartAxisConfigDto ChangeMetric { get; set; } = new();

    public ChartAxisConfigDto TimeField { get; set; } = new();

    public ChartAxisConfigDto HealthScore { get; set; } = new();

    public ChartAxisConfigDto RiskScore { get; set; } = new();

    /// <summary>scatter | cluster | hybrid</summary>
    public string LayoutMode { get; set; } = "hybrid";

    /// <summary>linear | sqrt | log</summary>
    public string SizeScale { get; set; } = "sqrt";

    public int MinRadiusPx { get; set; } = 42;

    public int MaxRadiusPx { get; set; } = 130;

    /// <summary>category | health_score</summary>
    public string ColorBy { get; set; } = "category";

    /// <summary>risk_score | none</summary>
    public string PulseBy { get; set; } = "risk_score";

    /// <summary>
    /// Risk (or pulse metric) value that gates the shrink/grow pulse. Default 50.
    /// </summary>
    public double PulseThreshold { get; set; } = 50;

    /// <summary>above | below — whether pulse fires when the metric is above or below the threshold.</summary>
    public string PulseThresholdMode { get; set; } = "above";

    public double ShapeVariation { get; set; } = 0.35;

    /// <summary>none | compact | full</summary>
    public string LabelMode { get; set; } = "compact";

    public bool AnimationEnabled { get; set; } = true;

    /// <summary>
    /// Pulse cycle speed multiplier (1 = default). Typical range 0.25–3.
    /// </summary>
    public double AnimationSpeed { get; set; } = 1;
}

/// <summary>
/// Amoeba Story visualization component DTO.
/// </summary>
public class AmoebaStoryComponentDto : VdabComponentDto
{
    public required AmoebaStoryProps Props { get; set; }
}
