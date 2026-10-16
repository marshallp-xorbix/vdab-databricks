using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds source→destination grain SQL for Flow Field Story.
/// </summary>
internal static class FlowFieldQueryBuilder
{
    public static string? BuildSql(ChartBindingContext ctx, FlowFieldStoryProps props)
    {
        if (string.IsNullOrWhiteSpace(props.SourceStage.Field)
            || string.IsNullOrWhiteSpace(props.DestinationStage.Field)
            || string.IsNullOrWhiteSpace(props.FlowVolume.Field)
            || string.IsNullOrWhiteSpace(props.StageOrder.Field))
        {
            return null;
        }

        bool lake = ctx.UsesLakebase;
        string table = ctx.TableReference;
        string sourceCol = StorySqlHelper.Quote(lake, props.SourceStage.Field!);
        string destCol = StorySqlHelper.Quote(lake, props.DestinationStage.Field!);

        List<string> selectParts =
        [
            $"{sourceCol} as source_stage",
            $"{destCol} as destination_stage",
            $"{StorySqlHelper.BuildMeasure(lake, props.FlowVolume, noneFallback: "sum")} as flow_volume",
            $"{StorySqlHelper.BuildMeasure(lake, props.StageOrder, noneFallback: "max")} as stage_order",
        ];

        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.ConversionPct, "conversion_pct", noneFallback: "avg");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.DropOffCount, "drop_off", noneFallback: "sum");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.AvgTimeInStage, "avg_time_in_stage", noneFallback: "avg");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Status, "status");

        string fromClause = StorySqlHelper.ApplyLatestTimeFilter(table, lake, props.TimeField);
        string selectList = string.Join(", ", selectParts);
        return $"SELECT {selectList} FROM {fromClause} GROUP BY {sourceCol}, {destCol} LIMIT 500";
    }
}
