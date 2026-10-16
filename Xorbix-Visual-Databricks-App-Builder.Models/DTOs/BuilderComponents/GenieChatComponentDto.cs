namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Properties for Genie conversational chat bound to a <c>genie_space</c> app resource (resource <c>name</c> / key).
/// </summary>
public class GenieChatProps
{
    /// <summary>
    /// App resource key (same as <c>name</c> in App Settings / Databricks app resources), used as <c>valueFrom</c> in <c>app.yaml</c>.
    /// </summary>
    public string GenieSpaceAppResourceName { get; set; } = string.Empty;

    /// <summary>
    /// Optional subtitle in the designer placeholder only; generated Streamlit uses a fixed subheader.
    /// </summary>
    public string Title { get; set; } = "Genie Chat";

    /// <summary>
    /// When true, wraps the chat in a bordered container (Streamlit <c>st.container(border=True)</c> uses app theme).
    /// </summary>
    public bool ShowBorder { get; set; }

    /// <summary>
    /// Target total vertical footprint in pixels for the Genie chat region: scrollable message history plus a reserved band for <c>st.chat_input</c> (approximate; actual input chrome depends on theme).
    /// </summary>
    public int ChatTotalHeightPixels { get; set; } = ComponentHeightBounds.DefaultPixels;
}

public class GenieChatComponentDto : VdabComponentDto
{
    public required GenieChatProps Props { get; set; }
}
