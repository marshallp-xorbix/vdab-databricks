namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

/// <summary>
/// Classifies Spark / Unity Catalog / Postgres type strings for chart measure validation
/// (aligned with frontend <c>getChartColumnTypeCategory</c>).
/// Lakebase returns Postgres types such as <c>double precision</c>.
/// </summary>
internal static class ChartColumnTypeCategoryHelper
{
    /// <summary>Returns one of: numeric, temporal, string, boolean, unknown.</summary>
    public static string GetCategory(string? typeText)
    {
        if (string.IsNullOrWhiteSpace(typeText))
        {
            return "unknown";
        }

        string t = typeText.Trim().ToLowerInvariant();

        if (t == "date"
            || t.Contains("timestamp", StringComparison.Ordinal)
            || t == "time"
            || t.StartsWith("time ", StringComparison.Ordinal))
        {
            return "temporal";
        }

        if (t == "boolean" || t == "bool" || t.StartsWith("boolean", StringComparison.Ordinal))
        {
            return "boolean";
        }

        if (t is "tinyint" or "smallint" or "int" or "integer" or "bigint" or "long" or "float" or "real" or "double"
            or "int2" or "int4" or "int8" or "float4" or "float8" or "money"
            || t.Contains("double", StringComparison.Ordinal)
            || t.Contains("decimal", StringComparison.Ordinal)
            || t.Contains("numeric", StringComparison.Ordinal)
            || t.Contains("number", StringComparison.Ordinal)
            || t.Contains("float", StringComparison.Ordinal)
            || t.Contains("serial", StringComparison.Ordinal))
        {
            return "numeric";
        }

        if (t.Contains("varchar", StringComparison.Ordinal)
            || t.Contains("char", StringComparison.Ordinal)
            || t == "string"
            || t.Contains("text", StringComparison.Ordinal)
            || t.Contains("binary", StringComparison.Ordinal)
            || t.Contains("variant", StringComparison.Ordinal)
            || t.Contains("array", StringComparison.Ordinal)
            || t.Contains("map", StringComparison.Ordinal)
            || t.Contains("struct", StringComparison.Ordinal))
        {
            return "string";
        }

        return "unknown";
    }
}
