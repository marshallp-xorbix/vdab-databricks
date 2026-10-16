namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Streamlit theme values sent with deploy / code-preview requests.
/// </summary>
public class StreamlitThemeConfig
{
    public string PrimaryColor { get; set; } = "orange";

    public string BackgroundColor { get; set; } = "orange";

    public string SecondaryBackgroundColor { get; set; } = "#F0F2F6";

    public string TextColor { get; set; } = "blue";

    /// <summary>
    /// Max content width in pixels for the generated Streamlit page.
    /// </summary>
    public int PageWidth { get; set; } = PageWidthBounds.DefaultPixels;
}
