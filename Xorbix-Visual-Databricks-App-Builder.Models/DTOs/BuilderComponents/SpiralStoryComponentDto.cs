namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Props for the Spiral Story visualization (progressive journey milestones).
/// </summary>
public class SpiralStoryProps
{
    public string? Title { get; set; }

    public ChartAxisConfigDto JourneyName { get; set; } = new();

    public ChartAxisConfigDto Stage { get; set; } = new();

    public ChartAxisConfigDto TimelineField { get; set; } = new();

    public ChartAxisConfigDto ProgressPct { get; set; } = new();

    public ChartAxisConfigDto MetricValue { get; set; } = new();

    public ChartAxisConfigDto TargetDate { get; set; } = new();

    public ChartAxisConfigDto ActualDate { get; set; } = new();

    public ChartAxisConfigDto Status { get; set; } = new();

    public ChartAxisConfigDto RiskScore { get; set; } = new();

    public ChartAxisConfigDto Owner { get; set; } = new();

    public ChartAxisConfigDto KeyAchievement { get; set; } = new();

    public ChartAxisConfigDto Cost { get; set; } = new();

    public bool ShowLabels { get; set; } = true;

    public bool ShowRiskGlow { get; set; } = true;

    public bool ShowVariance { get; set; } = true;

    /// <summary>
    /// When true, marker positions along the spiral are proportional to timeline values.
    /// When false (default), markers use equal angular steps.
    /// </summary>
    public bool SpaceByTimeline { get; set; }
}

/// <summary>
/// Spiral Story visualization component DTO.
/// </summary>
public class SpiralStoryComponentDto : VdabComponentDto
{
    public required SpiralStoryProps Props { get; set; }
}
