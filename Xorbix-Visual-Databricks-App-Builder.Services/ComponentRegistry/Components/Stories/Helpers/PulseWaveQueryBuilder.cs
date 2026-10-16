using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds time-series grain SQL for Pulse Wave Story (one row per time period, ordered).
/// </summary>
internal static class PulseWaveQueryBuilder
{
    public static string? BuildSql(ChartBindingContext ctx, PulseWaveStoryProps props)
    {
        if (string.IsNullOrWhiteSpace(props.TimeField.Field)
            || string.IsNullOrWhiteSpace(props.MetricValue.Field)
            || string.IsNullOrWhiteSpace(props.BaselineValue.Field))
        {
            return null;
        }

        bool lake = ctx.UsesLakebase;
        string table = ctx.TableReference;
        string timeCol = StorySqlHelper.Quote(lake, props.TimeField.Field!);

        List<string> selectParts =
        [
            $"{timeCol} as time_period",
            $"{BuildMetricMeasure(lake, props)} as metric_value",
            $"{StorySqlHelper.BuildMeasure(lake, props.BaselineValue, noneFallback: "avg")} as baseline_value",
        ];

        StorySqlHelper.AddOptionalDim(selectParts, lake, props.EventName, "event_name");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.EventType, "event_type");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.ImpactScore, "impact_score", noneFallback: "avg");

        string selectList = string.Join(", ", selectParts);
        return $"SELECT {selectList} FROM {table} GROUP BY {timeCol} ORDER BY {timeCol} LIMIT 500";
    }

    private static string BuildMetricMeasure(bool usesLakebase, PulseWaveStoryProps props)
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
