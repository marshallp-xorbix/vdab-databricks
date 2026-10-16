namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Props for the Flow Field Story visualization (directional stage-to-stage streams).
/// </summary>
public class FlowFieldStoryProps
{
    public string? Title { get; set; }

    public ChartAxisConfigDto SourceStage { get; set; } = new();

    public ChartAxisConfigDto DestinationStage { get; set; } = new();

    public ChartAxisConfigDto FlowVolume { get; set; } = new();

    public ChartAxisConfigDto StageOrder { get; set; } = new();

    public ChartAxisConfigDto TimeField { get; set; } = new();

    public ChartAxisConfigDto ConversionPct { get; set; } = new();

    public ChartAxisConfigDto DropOffCount { get; set; } = new();

    public ChartAxisConfigDto AvgTimeInStage { get; set; } = new();

    public ChartAxisConfigDto Status { get; set; } = new();

    public bool ShowDropOffs { get; set; } = true;

    public bool ShowLabels { get; set; } = true;
}

/// <summary>
/// Flow Field Story visualization component DTO.
/// </summary>
public class FlowFieldStoryComponentDto : VdabComponentDto
{
    public required FlowFieldStoryProps Props { get; set; }
}
