using System.Text.Json;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;

/// <summary>
/// Shared helpers for reading layout JSON stored on <c>VdabComponentDto.Layout</c>.
/// Layout is a compact JSON string (e.g. <c>{"y":2}</c> or <c>{"tabIndex":1,"y":0}</c>).
/// These helpers are intentionally lenient — corrupt or missing JSON falls back to
/// sensible defaults and never throws.
/// </summary>
public static class LayoutJsonHelper
{
    /// <summary>
    /// Returns the <c>tabIndex</c> value from a layout JSON string.
    /// Returns 0 (first pane) when the layout is null, empty, lacks the property, or is unparseable.
    /// </summary>
    /// <param name="layout">Layout JSON string, e.g. <c>{"tabIndex":1,"y":0}</c>.</param>
    public static int ParseTabIndex(string? layout)
    {
        if (string.IsNullOrEmpty(layout)) return 0;
        try
        {
            using JsonDocument doc = JsonDocument.Parse(layout);
            if (doc.RootElement.TryGetProperty("tabIndex", out JsonElement tabIndexEl))
                return tabIndexEl.GetInt32();
        }
        catch
        {
            // Intentionally ignored — fall through to default
        }
        return 0;
    }

    /// <summary>
    /// Returns the <c>y</c> position from a layout JSON string.
    /// Returns <see cref="double.MaxValue"/> when the layout is null, empty, lacks the property,
    /// or is unparseable, so that components without explicit positioning sort to the end.
    /// </summary>
    /// <param name="layout">Layout JSON string, e.g. <c>{"y":2}</c>.</param>
    public static double ParseLayoutY(string? layout)
    {
        if (string.IsNullOrEmpty(layout)) return double.MaxValue;
        try
        {
            using JsonDocument doc = JsonDocument.Parse(layout);
            if (doc.RootElement.TryGetProperty("y", out JsonElement yEl))
                return yEl.GetDouble();
        }
        catch
        {
            // Intentionally ignored — fall through to default
        }
        return double.MaxValue;
    }

}
