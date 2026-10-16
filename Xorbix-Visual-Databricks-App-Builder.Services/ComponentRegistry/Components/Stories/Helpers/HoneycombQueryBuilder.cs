using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds item-grain SQL for Honeycomb Story (one row per item_name).
/// </summary>
internal static class HoneycombQueryBuilder
{
    public static string? BuildSql(ChartBindingContext ctx, HoneycombStoryProps props)
    {
        if (string.IsNullOrWhiteSpace(props.ItemName.Field)
            || string.IsNullOrWhiteSpace(props.ImpactScore.Field)
            || string.IsNullOrWhiteSpace(props.PriorityLevel.Field)
            || string.IsNullOrWhiteSpace(props.ProgressPct.Field)
            || string.IsNullOrWhiteSpace(props.Category.Field))
        {
            return null;
        }

        bool lake = ctx.UsesLakebase;
        string table = ctx.TableReference;
        string itemCol = StorySqlHelper.Quote(lake, props.ItemName.Field!);

        List<string> selectParts =
        [
            $"{itemCol} as item_name",
            $"{StorySqlHelper.BuildMeasure(lake, props.ImpactScore, noneFallback: "avg")} as impact_score",
            $"{StorySqlHelper.BuildDimOrAgg(lake, props.PriorityLevel)} as priority_level",
            $"{StorySqlHelper.BuildMeasure(lake, props.ProgressPct, noneFallback: "avg")} as progress_pct",
            $"{StorySqlHelper.BuildDimOrAgg(lake, props.Category)} as category",
        ];

        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Trend, "trend");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.RiskScore, "risk_score", noneFallback: "avg");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Owner, "owner");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.DueDate, "due_date");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.Investment, "investment", noneFallback: "sum");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.BenefitValue, "benefit_value", noneFallback: "sum");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Notes, "notes");
        StorySqlHelper.AddOptionalDim(selectParts, lake, props.Status, "status");

        string fromClause = StorySqlHelper.ApplyLatestTimeFilter(table, lake, props.TimeField);
        string selectList = string.Join(", ", selectParts);
        return $"SELECT {selectList} FROM {fromClause} GROUP BY {itemCol} LIMIT 100";
    }
}
