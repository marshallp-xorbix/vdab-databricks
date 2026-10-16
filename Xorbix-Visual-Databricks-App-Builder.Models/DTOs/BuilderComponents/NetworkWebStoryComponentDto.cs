namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Props for the Network Web Story visualization (relationship / force graph).
/// </summary>
public class NetworkWebStoryProps
{
    public string? Title { get; set; }

    public ChartAxisConfigDto SourceEntityId { get; set; } = new();

    public ChartAxisConfigDto SourceEntityLabel { get; set; } = new();

    public ChartAxisConfigDto TargetEntityId { get; set; } = new();

    public ChartAxisConfigDto TargetEntityLabel { get; set; } = new();

    public ChartAxisConfigDto RelationshipType { get; set; } = new();

    public ChartAxisConfigDto RelationshipWeight { get; set; } = new();

    public ChartAxisConfigDto TimeField { get; set; } = new();

    public ChartAxisConfigDto Direction { get; set; } = new();

    public ChartAxisConfigDto EdgeValue { get; set; } = new();

    public ChartAxisConfigDto Frequency { get; set; } = new();

    public ChartAxisConfigDto EdgeRiskScore { get; set; } = new();

    public ChartAxisConfigDto EdgeStatus { get; set; } = new();

    public ChartAxisConfigDto SourceCategory { get; set; } = new();

    public ChartAxisConfigDto TargetCategory { get; set; } = new();

    public ChartAxisConfigDto SourceValue { get; set; } = new();

    public ChartAxisConfigDto TargetValue { get; set; } = new();

    public ChartAxisConfigDto SourceHealthScore { get; set; } = new();

    public ChartAxisConfigDto TargetHealthScore { get; set; } = new();

    public ChartAxisConfigDto SourceRiskScore { get; set; } = new();

    public ChartAxisConfigDto TargetRiskScore { get; set; } = new();

    /// <summary>force | radial</summary>
    public string LayoutAlgorithm { get; set; } = "force";

    /// <summary>degree | value | none</summary>
    public string NodeSizeBy { get; set; } = "degree";

    /// <summary>category | health_score | risk_score</summary>
    public string NodeColorBy { get; set; } = "category";

    /// <summary>weight | value | frequency | none</summary>
    public string EdgeWidthBy { get; set; } = "weight";

    /// <summary>relationship_type | risk_score | status | none</summary>
    public string EdgeColorBy { get; set; } = "relationship_type";

    public bool ShowArrows { get; set; } = true;

    /// <summary>Neighborhood highlight hops (1–3).</summary>
    public int HighlightDepth { get; set; } = 1;

    public double MinWeightFilter { get; set; } = 0;

    public int MaxNodes { get; set; } = 300;

    public int MaxEdges { get; set; } = 800;
}

/// <summary>
/// Network Web Story visualization component DTO.
/// </summary>
public class NetworkWebStoryComponentDto : VdabComponentDto
{
    public required NetworkWebStoryProps Props { get; set; }
}
