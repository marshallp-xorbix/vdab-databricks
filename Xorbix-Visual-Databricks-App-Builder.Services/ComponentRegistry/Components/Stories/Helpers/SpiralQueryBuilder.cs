using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds journey+stage grain SQL for Spiral Story (ordered by timeline; no latest-period filter).
/// </summary>
internal static class SpiralQueryBuilder
{
    public static string? BuildSql(ChartBindingContext ctx, SpiralStoryProps props)
    {
        if (string.IsNullOrWhiteSpace(props.JourneyName.Field)
            || string.IsNullOrWhiteSpace(props.Stage.Field)
            || string.IsNullOrWhiteSpace(props.TimelineField.Field)
            || string.IsNullOrWhiteSpace(props.ProgressPct.Field)
            || string.IsNullOrWhiteSpace(props.MetricValue.Field))
        {
            return null;
        }

        bool lake = ctx.UsesLakebase;
        string table = ctx.TableReference;
        string journeyCol = StorySqlHelper.Quote(lake, props.JourneyName.Field!);
        string stageCol = StorySqlHelper.Quote(lake, props.Stage.Field!);
        string timelineCol = StorySqlHelper.Quote(lake, props.TimelineField.Field!);

        List<string> selectParts =
        [
            $"{journeyCol} as journey_name",
            $"{stageCol} as stage",
            $"MAX({timelineCol}) as timeline",
            $"{StorySqlHelper.BuildMeasure(lake, props.ProgressPct, noneFallback: "avg")} as progress_pct",
            $"{StorySqlHelper.BuildMeasure(lake, props.MetricValue, noneFallback: "sum")} as metric_value",
        ];

        StorySqlHelper.AddOptionalDim(selectParts, lake, props.TargetDate, "target_date");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.ActualDate, "actual_date");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Status, "status");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.RiskScore, "risk_score", noneFallback: "avg");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Owner, "owner");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.KeyAchievement, "key_achievement");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.Cost, "cost", noneFallback: "sum");

        string selectList = string.Join(", ", selectParts);
        return $"SELECT {selectList} FROM {table} GROUP BY {journeyCol}, {stageCol} ORDER BY MAX({timelineCol}) LIMIT 100";
    }
}
