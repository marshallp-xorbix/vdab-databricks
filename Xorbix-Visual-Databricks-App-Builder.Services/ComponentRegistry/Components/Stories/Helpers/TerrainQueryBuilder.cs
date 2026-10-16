using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds x × y grain SQL for Terrain Story (one cell per dimension pair).
/// </summary>
internal static class TerrainQueryBuilder
{
    public static string? BuildSql(ChartBindingContext ctx, TerrainStoryProps props)
    {
        if (string.IsNullOrWhiteSpace(props.XDimension.Field)
            || string.IsNullOrWhiteSpace(props.YDimension.Field)
            || string.IsNullOrWhiteSpace(props.HeightMetric.Field))
        {
            return null;
        }

        bool lake = ctx.UsesLakebase;
        string table = ctx.TableReference;
        string xCol = StorySqlHelper.Quote(lake, props.XDimension.Field!);
        string yCol = StorySqlHelper.Quote(lake, props.YDimension.Field!);

        List<string> selectParts =
        [
            $"{xCol} as x_value",
            $"{yCol} as y_value",
            $"{BuildHeightMeasure(lake, props)} as height_value",
        ];

        StorySqlHelper.AddOptionalDim(selectParts, lake, props.TerrainCategory, "category");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.RiskScore, "risk_score", noneFallback: "avg");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.TargetValue, "target_value", noneFallback: "avg");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.BaselineValue, "baseline_value", noneFallback: "avg");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.ForecastValue, "forecast_value", noneFallback: "avg");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.VolumeMetric, "volume_value", noneFallback: "sum");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Status, "status");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.EventName, "event_name");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.EventDate, "event_date");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.CalloutText, "callout_text");

        string fromClause = StorySqlHelper.ApplyLatestTimeFilter(table, lake, props.TimeField);
        string selectList = string.Join(", ", selectParts);
        return $"SELECT {selectList} FROM {fromClause} GROUP BY {xCol}, {yCol} LIMIT 500";
    }

    private static string BuildHeightMeasure(bool usesLakebase, TerrainStoryProps props)
    {
        string transform = (props.HeightMetric.Transform ?? "none").Trim().ToLowerInvariant();
        if (transform is "none" or "")
        {
            string method = (props.AggregationMethod ?? "sum").Trim().ToLowerInvariant();
            transform = method is "avg" or "max" or "min" or "sum" ? method : "sum";
        }

        return StorySqlHelper.BuildMeasure(usesLakebase, props.HeightMetric, noneFallback: transform);
    }
}
