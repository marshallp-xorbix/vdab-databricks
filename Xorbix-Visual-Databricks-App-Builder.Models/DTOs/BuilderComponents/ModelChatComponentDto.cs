namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Properties for a chat component bound to a Databricks Model Serving endpoint app resource.
/// </summary>
public class ModelChatProps
{
    /// <summary>
    /// App resource key (same as <c>name</c> in App Settings / Databricks app resources), used as <c>valueFrom</c> in <c>app.yaml</c>.
    /// </summary>
    public string ServingEndpointAppResourceName { get; set; } = string.Empty;

    /// <summary>
    /// Optional title shown in the designer preview.
    /// </summary>
    public string Title { get; set; } = "Model Chat";

    /// <summary>
    /// When true, wraps the chat in a bordered container (Streamlit <c>st.container(border=True)</c> uses app theme).
    /// </summary>
    public bool ShowBorder { get; set; }

    /// <summary>
    /// Target total vertical footprint in pixels for the chat region: scrollable message history plus a reserved band for <c>st.chat_input</c>.
    /// </summary>
    public int ChatTotalHeightPixels { get; set; } = ComponentHeightBounds.DefaultPixels;
}

/// <summary>
/// Canvas component DTO for Model Chat.
/// </summary>
public class ModelChatComponentDto : VdabComponentDto
{
    public required ModelChatProps Props { get; set; }
}
