using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds geographic-area grain SQL for Heat Map Story (one row per area key).
/// </summary>
internal static class HeatMapQueryBuilder
{
    public static string? BuildSql(ChartBindingContext ctx, HeatMapStoryProps props)
    {
        if (string.IsNullOrWhiteSpace(props.GeographicArea.Field)
            || string.IsNullOrWhiteSpace(props.MetricValue.Field))
        {
            return null;
        }

        bool lake = ctx.UsesLakebase;
        string table = ctx.TableReference;
        string areaCol = StorySqlHelper.Quote(lake, props.GeographicArea.Field!);

        List<string> selectParts =
        [
            $"{areaCol} as area_key",
            $"{BuildMetricMeasure(lake, props)} as metric_value",
        ];

        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.SecondaryMetric, "secondary_value", noneFallback: "sum");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.ChangePct, "change_pct", noneFallback: "avg");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.TargetValue, "target_value", noneFallback: "avg");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.RiskScore, "risk_score", noneFallback: "avg");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Category, "category");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.ForecastValue, "forecast_value", noneFallback: "avg");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Notes, "notes");

        string fromClause = StorySqlHelper.ApplyLatestTimeFilter(table, lake, props.TimeField);
        string selectList = string.Join(", ", selectParts);
        return $"SELECT {selectList} FROM {fromClause} GROUP BY {areaCol} LIMIT 500";
    }

    private static string BuildMetricMeasure(bool usesLakebase, HeatMapStoryProps props)
    {
        string transform = (props.MetricValue.Transform ?? "none").Trim().ToLowerInvariant();
        if (transform is "none" or "")
        {
            string method = (props.AggregationMethod ?? "sum").Trim().ToLowerInvariant();
            transform = method is "avg" or "max" or "min" or "sum" ? method : "sum";
        }

        return StorySqlHelper.BuildMeasure(usesLakebase, props.MetricValue, noneFallback: transform);
    }
}
