using System.Globalization;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// App page content width bounds for Streamlit <c>.block-container</c> max-width.
/// IMPORTANT: Keep numeric values in sync with frontend <c>pageWidthDefaults.ts</c>.
/// Dual definition is intentional — .NET and TypeScript cannot share a single constants module.
/// </summary>
public static class PageWidthBounds
{
    /// <summary>Minimum page width in pixels (Streamlit default centered layout).</summary>
    public const int MinPixels = 730;

    /// <summary>Maximum page width in pixels.</summary>
    public const int MaxPixels = 1800;

    /// <summary>Default page width when unset or invalid (matches the Streamlit minimum).</summary>
    public const int DefaultPixels = MinPixels;

    /// <summary>Theme JSON key used in app theme storage and deploy mapping.</summary>
    public const string ThemeKey = "pageWidth";

    /// <summary>
    /// Clamps a page width to the supported range.
    /// </summary>
    public static int Clamp(int value) => Math.Clamp(value, MinPixels, MaxPixels);

    /// <summary>
    /// Parses a theme JSON page-width value, clamping to bounds.
    /// Invalid or missing values yield <see cref="DefaultPixels"/>.
    /// Aligned with frontend <c>parsePageWidth</c> (Number → round → clamp).
    /// </summary>
    public static int Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return DefaultPixels;
        }

        if (!double.TryParse(
                value.Trim(),
                NumberStyles.Float,
                CultureInfo.InvariantCulture,
                out double parsed)
            || double.IsNaN(parsed)
            || double.IsInfinity(parsed))
        {
            return DefaultPixels;
        }

        return Clamp((int)Math.Round(parsed, MidpointRounding.AwayFromZero));
    }
}
