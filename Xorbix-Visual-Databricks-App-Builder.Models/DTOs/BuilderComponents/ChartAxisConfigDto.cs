namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Field binding for a chart axis or measure (Databricks-style).
/// Serialized as camelCase: field, displayName, scaleType, transform.
/// </summary>
public class ChartAxisConfigDto
{
    /// <summary>Bound column name, or null for synthetic measures (e.g. row count).</summary>
    public string? Field { get; set; }

    /// <summary>Human-readable axis / legend title (replaces legacy XAxisTitle / YAxisTitle).</summary>
    public string? DisplayName { get; set; }

    /// <summary>Either <c>continuous</c> or <c>categorical</c>.</summary>
    public string ScaleType { get; set; } = "categorical";

    /// <summary>
    /// One of: none, sum, avg, count, count_distinct, min, max.
    /// Interpretation depends on chart role (dimension vs measure).
    /// </summary>
    public string Transform { get; set; } = "none";
}
