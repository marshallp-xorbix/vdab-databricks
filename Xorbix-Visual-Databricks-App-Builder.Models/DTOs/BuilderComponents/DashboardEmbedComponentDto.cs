namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Properties for embedding a Databricks Lakeview dashboard via Streamlit <c>components.iframe</c>.
/// </summary>
public class DashboardEmbedProps
{
    /// <summary>
    /// HTTPS embed URL from the workspace (e.g. <c>/embed/dashboardsv3/...</c>).
    /// </summary>
    public string Src { get; set; } = string.Empty;

    /// <summary>
    /// Iframe height in CSS pixels.
    /// </summary>
    public int Height { get; set; } = ComponentHeightBounds.DefaultPixels;

    /// <summary>
    /// When true, the iframe may show scrollbars when content exceeds the height.
    /// When null (e.g. property omitted from stored JSON), Streamlit generation treats it as true to match canvas <c>props.scrolling !== false</c>.
    /// </summary>
    public bool? Scrolling { get; set; }
}

public class DashboardEmbedComponentDto : VdabComponentDto
{
    public required DashboardEmbedProps Props { get; set; }
}
