using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Shared SQL helpers for story visualization grain queries.
/// </summary>
internal static class StorySqlHelper
{
    /// <summary>Quotes an identifier for the active SQL dialect.</summary>
    public static string Quote(bool usesLakebase, string name) =>
        ChartSqlDialectHelper.QuoteIdent(usesLakebase, name);

    /// <summary>
    /// Builds a measure expression from a chart axis transform.
    /// When transform is <c>none</c>, uses <paramref name="noneFallback"/>.
    /// </summary>
    public static string BuildMeasure(
        bool usesLakebase,
        ChartAxisConfigDto axis,
        string noneFallback = "sum")
    {
        string quoted = Quote(usesLakebase, axis.Field!);
        string transform = (axis.Transform ?? "none").Trim().ToLowerInvariant();
        if (transform is "none" or "")
        {
            transform = noneFallback;
        }

        return transform switch
        {
            "avg" => $"AVG({quoted})",
            "min" => $"MIN({quoted})",
            "max" => $"MAX({quoted})",
            "count" => $"COUNT({quoted})",
            "count_distinct" => $"COUNT(DISTINCT {quoted})",
            "sum" or "none" or "" => $"SUM({quoted})",
            _ => $"SUM({quoted})",
        };
    }

    /// <summary>
    /// Builds a dimension expression for GROUP BY queries (MAX when transform is none).
    /// </summary>
    public static string BuildDimOrAgg(bool usesLakebase, ChartAxisConfigDto axis)
    {
        string quoted = Quote(usesLakebase, axis.Field!);
        string transform = (axis.Transform ?? "none").Trim().ToLowerInvariant();
        if (transform is "none" or "")
        {
            return $"MAX({quoted})";
        }

        return BuildMeasure(usesLakebase, axis, noneFallback: "max");
    }

    /// <summary>
    /// When a time field is mapped, wraps the table so only the latest period is queried.
    /// </summary>
    public static string ApplyLatestTimeFilter(
        string table,
        bool usesLakebase,
        ChartAxisConfigDto timeField)
    {
        if (string.IsNullOrWhiteSpace(timeField.Field))
        {
            return table;
        }

        string timeCol = Quote(usesLakebase, timeField.Field!);
        return $"(SELECT * FROM {table} WHERE {timeCol} = (SELECT MAX({timeCol}) FROM {table}))";
    }

    /// <summary>
    /// Adds a raw quoted column alias when the axis field is mapped.
    /// </summary>
    public static void AddOptionalQuoted(
        List<string> selectParts,
        bool usesLakebase,
        ChartAxisConfigDto axis,
        string alias)
    {
        if (!string.IsNullOrWhiteSpace(axis.Field))
        {
            selectParts.Add($"{Quote(usesLakebase, axis.Field!)} as {alias}");
        }
    }

    /// <summary>
    /// Adds a measure expression when the axis field is mapped.
    /// </summary>
    public static void AddOptionalMeasure(
        List<string> selectParts,
        bool usesLakebase,
        ChartAxisConfigDto axis,
        string alias,
        string noneFallback = "sum")
    {
        if (!string.IsNullOrWhiteSpace(axis.Field))
        {
            selectParts.Add($"{BuildMeasure(usesLakebase, axis, noneFallback)} as {alias}");
        }
    }

    /// <summary>
    /// Adds a dimension/aggregate expression when the axis field is mapped.
    /// </summary>
    public static void AddOptionalDim(
        List<string> selectParts,
        bool usesLakebase,
        ChartAxisConfigDto axis,
        string alias)
    {
        if (!string.IsNullOrWhiteSpace(axis.Field))
        {
            selectParts.Add($"{BuildDimOrAgg(usesLakebase, axis)} as {alias}");
        }
    }
}
