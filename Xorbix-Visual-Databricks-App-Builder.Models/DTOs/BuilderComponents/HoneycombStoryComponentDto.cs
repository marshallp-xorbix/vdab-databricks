namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Props for the Honeycomb Story visualization (hexagonal impact map).
/// </summary>
public class HoneycombStoryProps
{
    public string? Title { get; set; }

    public ChartAxisConfigDto ItemName { get; set; } = new();

    public ChartAxisConfigDto ImpactScore { get; set; } = new();

    public ChartAxisConfigDto PriorityLevel { get; set; } = new();

    public ChartAxisConfigDto ProgressPct { get; set; } = new();

    public ChartAxisConfigDto Category { get; set; } = new();

    public ChartAxisConfigDto TimeField { get; set; } = new();

    public ChartAxisConfigDto Trend { get; set; } = new();

    public ChartAxisConfigDto RiskScore { get; set; } = new();

    public ChartAxisConfigDto Owner { get; set; } = new();

    public ChartAxisConfigDto DueDate { get; set; } = new();

    public ChartAxisConfigDto Investment { get; set; } = new();

    public ChartAxisConfigDto BenefitValue { get; set; } = new();

    public ChartAxisConfigDto Notes { get; set; } = new();

    public ChartAxisConfigDto Status { get; set; } = new();

    public bool ShowLabels { get; set; } = true;

    public bool ShowRiskBorders { get; set; } = true;

    public bool ShowTrendArrows { get; set; } = true;
}

/// <summary>
/// Honeycomb Story visualization component DTO.
/// </summary>
public class HoneycombStoryComponentDto : VdabComponentDto
{
    public required HoneycombStoryProps Props { get; set; }
}
