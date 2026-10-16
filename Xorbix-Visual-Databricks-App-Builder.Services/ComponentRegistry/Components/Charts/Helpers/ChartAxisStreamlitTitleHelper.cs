using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

/// <summary>
/// Axis titles for generated Streamlit match the canvas renderer: optional display name,
/// otherwise <c>transform(field)</c>, plain <c>field</c>, or <c>COUNT(*)</c> for bar Y with no column.
/// </summary>
internal static class ChartAxisStreamlitTitleHelper
{
    public static string GetTitle(ChartAxisConfigDto axis, string role)
    {
        if (!string.IsNullOrWhiteSpace(axis.DisplayName))
        {
            return axis.DisplayName!.Trim();
        }

        string transform = (axis.Transform ?? "none").Trim().ToLowerInvariant();
        bool hasField = !string.IsNullOrWhiteSpace(axis.Field);

        if (string.Equals(role, "bar-y", StringComparison.OrdinalIgnoreCase)
            && string.Equals(transform, "count", StringComparison.Ordinal)
            && !hasField)
        {
            return "COUNT(*)";
        }

        if (!hasField)
        {
            return string.Empty;
        }

        string field = axis.Field!.Trim();
        if (transform.Length == 0
            || string.Equals(transform, "none", StringComparison.OrdinalIgnoreCase))
        {
            return field;
        }

        return $"{transform}({field})";
    }
}
