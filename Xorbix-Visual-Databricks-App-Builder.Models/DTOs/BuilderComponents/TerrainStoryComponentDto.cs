namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Props for the Terrain Story visualization (performance landscape / isometric surface).
/// </summary>
public class TerrainStoryProps
{
    public string? Title { get; set; }

    public ChartAxisConfigDto XDimension { get; set; } = new();

    public ChartAxisConfigDto YDimension { get; set; } = new();

    public ChartAxisConfigDto HeightMetric { get; set; } = new();

    public ChartAxisConfigDto TimeField { get; set; } = new();

    public ChartAxisConfigDto TerrainCategory { get; set; } = new();

    public ChartAxisConfigDto RiskScore { get; set; } = new();

    public ChartAxisConfigDto TargetValue { get; set; } = new();

    public ChartAxisConfigDto BaselineValue { get; set; } = new();

    public ChartAxisConfigDto ForecastValue { get; set; } = new();

    public ChartAxisConfigDto VolumeMetric { get; set; } = new();

    public ChartAxisConfigDto Status { get; set; } = new();

    public ChartAxisConfigDto EventName { get; set; } = new();

    public ChartAxisConfigDto EventDate { get; set; } = new();

    public ChartAxisConfigDto CalloutText { get; set; } = new();

    /// <summary>surface | heat_surface | ridge</summary>
    public string TerrainMode { get; set; } = "surface";

    public double HeightScale { get; set; } = 1.0;

    /// <summary>none | bilinear</summary>
    public string Interpolation { get; set; } = "bilinear";

    public int GridResolution { get; set; } = 60;

    /// <summary>height_metric | risk_score | variance | category</summary>
    public string ColorBy { get; set; } = "height_metric";

    public bool ShowPeakLabels { get; set; } = true;

    public bool ShowValleyLabels { get; set; } = true;

    /// <summary>front | angled | top | free</summary>
    public string CameraPreset { get; set; } = "angled";

    /// <summary>sum | avg | max | min — used when HeightMetric.Transform is none</summary>
    public string AggregationMethod { get; set; } = "sum";
}

/// <summary>
/// Terrain Story visualization component DTO.
/// </summary>
public class TerrainStoryComponentDto : VdabComponentDto
{
    public required TerrainStoryProps Props { get; set; }
}
