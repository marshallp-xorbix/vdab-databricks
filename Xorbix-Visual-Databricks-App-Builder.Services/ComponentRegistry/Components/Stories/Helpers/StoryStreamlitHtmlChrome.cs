using System.Text;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Shared HTML document shell for story Streamlit <c>components.html</c> renderers.
/// </summary>
internal static class StoryStreamlitHtmlChrome
{
    /// <summary>
    /// Escapes HTML for embedding inside a Python triple-quoted string literal.
    /// </summary>
    public static string EscapeForPythonTripleQuoted(string html) =>
        html.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("'''", "\\'\\'\\'", StringComparison.Ordinal);

    /// <summary>
    /// Builds the common doctype/head/wrap/canvas/tip/hint document around a story renderer script.
    /// </summary>
    /// <param name="wrapBackground">CSS background for <c>#wrap</c>.</param>
    /// <param name="tipBackground">CSS background for <c>#tip</c>.</param>
    /// <param name="tipZIndex">z-index for the tooltip.</param>
    /// <param name="tipMaxWidthPx">max-width for the tooltip.</param>
    /// <param name="extraCss">Optional story-specific CSS rules (toolbar, legend, etc.).</param>
    /// <param name="wrapInnerHtml">Inner HTML of <c>#wrap</c> (toolbar/canvas/tip/legend/hint).</param>
    /// <param name="rendererScript">Story-specific JavaScript (no surrounding script tags).</param>
    public static string BuildDocument(
        string wrapBackground,
        string tipBackground,
        int tipZIndex,
        int tipMaxWidthPx,
        string extraCss,
        string wrapInnerHtml,
        string rendererScript)
    {
        StringBuilder sb = new StringBuilder();
        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html><head><meta charset=\"utf-8\"/>");
        sb.AppendLine("<style>");
        sb.AppendLine("html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}");
        sb.AppendLine($"#wrap{{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:{wrapBackground};box-shadow:0 1px 2px rgba(15,23,42,.08);}}");
        sb.AppendLine("canvas{display:block;width:100%;height:100%;touch-action:none;}");
        sb.AppendLine($"#tip{{display:none;position:absolute;pointer-events:none;z-index:{tipZIndex};background:{tipBackground};color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:{tipMaxWidthPx}px;line-height:1.35;}}");
        sb.AppendLine("#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}");
        if (!string.IsNullOrWhiteSpace(extraCss))
        {
            sb.AppendLine(extraCss.TrimEnd());
        }

        sb.AppendLine("</style></head><body>");
        sb.AppendLine($"<div id=\"wrap\">{wrapInnerHtml}</div>");
        sb.AppendLine("<script>");
        sb.AppendLine(rendererScript);
        sb.AppendLine("</script></body></html>");
        return sb.ToString();
    }
}
