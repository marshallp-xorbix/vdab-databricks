using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Shared defaults for story visualization component definitions and AI Builder props.
/// </summary>
internal static class StoryComponentDefaults
{
    /// <summary>
    /// Binding sources supported by all story visualizations (same as charts).
    /// </summary>
    public static List<string> CreateSupportedBindings() =>
    [
        "unityCatalogTable",
        "lakebaseProvisionedDatabase",
        "lakebaseAutoscaling",
    ];

    /// <summary>Creates Amoeba Story props with registry default axis scale/transform.</summary>
    public static AmoebaStoryProps CreateAmoebaProps(string? title = null) => new()
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Amoeba Story" : title,
        EntityId = Axis("categorical", "none"),
        EntityLabel = Axis("categorical", "none"),
        Category = Axis("categorical", "none"),
        SizeMetric = Axis("continuous", "sum"),
        XMetric = Axis("continuous", "avg"),
        YMetric = Axis("continuous", "avg"),
        ChangeMetric = Axis("continuous", "avg"),
        TimeField = Axis("categorical", "none"),
        HealthScore = Axis("continuous", "avg"),
        RiskScore = Axis("continuous", "avg"),
    };

    /// <summary>Creates Network Web Story props with registry default axis scale/transform.</summary>
    public static NetworkWebStoryProps CreateNetworkWebProps(string? title = null) => new()
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Network Web Story" : title,
        SourceEntityId = Axis("categorical", "none"),
        SourceEntityLabel = Axis("categorical", "none"),
        TargetEntityId = Axis("categorical", "none"),
        TargetEntityLabel = Axis("categorical", "none"),
        RelationshipType = Axis("categorical", "none"),
        RelationshipWeight = Axis("continuous", "none"),
        TimeField = Axis("categorical", "none"),
        Direction = Axis("categorical", "none"),
        EdgeValue = Axis("continuous", "none"),
        Frequency = Axis("continuous", "none"),
        EdgeRiskScore = Axis("continuous", "none"),
        EdgeStatus = Axis("categorical", "none"),
        SourceCategory = Axis("categorical", "none"),
        TargetCategory = Axis("categorical", "none"),
        SourceValue = Axis("continuous", "none"),
        TargetValue = Axis("continuous", "none"),
        SourceHealthScore = Axis("continuous", "none"),
        TargetHealthScore = Axis("continuous", "none"),
        SourceRiskScore = Axis("continuous", "none"),
        TargetRiskScore = Axis("continuous", "none"),
    };

    /// <summary>Creates Terrain Story props with registry default axis scale/transform.</summary>
    public static TerrainStoryProps CreateTerrainProps(string? title = null) => new()
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Terrain Story" : title,
        XDimension = Axis("categorical", "none"),
        YDimension = Axis("categorical", "none"),
        HeightMetric = Axis("continuous", "sum"),
        TimeField = Axis("categorical", "none"),
        TerrainCategory = Axis("categorical", "none"),
        RiskScore = Axis("continuous", "avg"),
        TargetValue = Axis("continuous", "avg"),
        BaselineValue = Axis("continuous", "avg"),
        ForecastValue = Axis("continuous", "avg"),
        VolumeMetric = Axis("continuous", "sum"),
        Status = Axis("categorical", "none"),
        EventName = Axis("categorical", "none"),
        EventDate = Axis("categorical", "none"),
        CalloutText = Axis("categorical", "none"),
    };

    /// <summary>Creates Heat Map Story props with registry default axis scale/transform.</summary>
    public static HeatMapStoryProps CreateHeatMapProps(string? title = null) => new()
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Heat Map Story" : title,
        GeographicArea = Axis("categorical", "none"),
        MetricValue = Axis("continuous", "sum"),
        TimeField = Axis("categorical", "none"),
        SecondaryMetric = Axis("continuous", "sum"),
        ChangePct = Axis("continuous", "avg"),
        TargetValue = Axis("continuous", "avg"),
        RiskScore = Axis("continuous", "avg"),
        Category = Axis("categorical", "none"),
        ForecastValue = Axis("continuous", "avg"),
        Notes = Axis("categorical", "none"),
    };

    /// <summary>Creates Pulse Wave Story props with registry default axis scale/transform.</summary>
    public static PulseWaveStoryProps CreatePulseWaveProps(string? title = null) => new()
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Pulse Wave Story" : title,
        MetricName = "Metric",
        TimeField = Axis("categorical", "none"),
        MetricValue = Axis("continuous", "sum"),
        BaselineValue = Axis("continuous", "avg"),
        EventName = Axis("categorical", "none"),
        EventType = Axis("categorical", "none"),
        ImpactScore = Axis("continuous", "avg"),
    };

    /// <summary>Creates Flow Field Story props with registry default axis scale/transform.</summary>
    public static FlowFieldStoryProps CreateFlowFieldProps(string? title = null) => new()
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Flow Field Story" : title,
        SourceStage = Axis("categorical", "none"),
        DestinationStage = Axis("categorical", "none"),
        FlowVolume = Axis("continuous", "sum"),
        StageOrder = Axis("continuous", "max"),
        TimeField = Axis("categorical", "none"),
        ConversionPct = Axis("continuous", "avg"),
        DropOffCount = Axis("continuous", "sum"),
        AvgTimeInStage = Axis("continuous", "avg"),
        Status = Axis("categorical", "none"),
    };

    /// <summary>Creates Honeycomb Story props with registry default axis scale/transform.</summary>
    public static HoneycombStoryProps CreateHoneycombProps(string? title = null) => new()
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Honeycomb Story" : title,
        ItemName = Axis("categorical", "none"),
        ImpactScore = Axis("continuous", "avg"),
        PriorityLevel = Axis("categorical", "none"),
        ProgressPct = Axis("continuous", "avg"),
        Category = Axis("categorical", "none"),
        TimeField = Axis("categorical", "none"),
        Trend = Axis("categorical", "none"),
        RiskScore = Axis("continuous", "avg"),
        Owner = Axis("categorical", "none"),
        DueDate = Axis("categorical", "none"),
        Investment = Axis("continuous", "sum"),
        BenefitValue = Axis("continuous", "sum"),
        Notes = Axis("categorical", "none"),
        Status = Axis("categorical", "none"),
    };

    /// <summary>Creates Spiral Story props with registry default axis scale/transform.</summary>
    public static SpiralStoryProps CreateSpiralProps(string? title = null) => new()
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Spiral Story" : title,
        JourneyName = Axis("categorical", "none"),
        Stage = Axis("categorical", "none"),
        TimelineField = Axis("categorical", "none"),
        ProgressPct = Axis("continuous", "avg"),
        MetricValue = Axis("continuous", "sum"),
        TargetDate = Axis("categorical", "none"),
        ActualDate = Axis("categorical", "none"),
        Status = Axis("categorical", "none"),
        RiskScore = Axis("continuous", "avg"),
        Owner = Axis("categorical", "none"),
        KeyAchievement = Axis("categorical", "none"),
        Cost = Axis("continuous", "sum"),
    };

    private static ChartAxisConfigDto Axis(string scaleType, string transform) =>
        new() { ScaleType = scaleType, Transform = transform };
}
