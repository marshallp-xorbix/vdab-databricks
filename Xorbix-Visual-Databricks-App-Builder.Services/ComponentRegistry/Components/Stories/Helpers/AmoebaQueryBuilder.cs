using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds grain SQL for Amoeba Story (one row per entity_id).
/// </summary>
internal static class AmoebaQueryBuilder
{
    public static string? BuildSql(ChartBindingContext ctx, AmoebaStoryProps props)
    {
        if (string.IsNullOrWhiteSpace(props.EntityId.Field)
            || string.IsNullOrWhiteSpace(props.EntityLabel.Field)
            || string.IsNullOrWhiteSpace(props.Category.Field)
            || string.IsNullOrWhiteSpace(props.SizeMetric.Field)
            || string.IsNullOrWhiteSpace(props.XMetric.Field)
            || string.IsNullOrWhiteSpace(props.YMetric.Field)
            || string.IsNullOrWhiteSpace(props.ChangeMetric.Field))
        {
            return null;
        }

        bool lake = ctx.UsesLakebase;
        string table = ctx.TableReference;
        string entityId = StorySqlHelper.Quote(lake, props.EntityId.Field!);

        List<string> selectParts =
        [
            $"{entityId} as entity_id",
            $"{StorySqlHelper.BuildDimOrAgg(lake, props.EntityLabel)} as entity_label",
            $"{StorySqlHelper.BuildDimOrAgg(lake, props.Category)} as category",
            $"{StorySqlHelper.BuildMeasure(lake, props.SizeMetric)} as size_value",
            $"{StorySqlHelper.BuildMeasure(lake, props.XMetric)} as x_value",
            $"{StorySqlHelper.BuildMeasure(lake, props.YMetric)} as y_value",
            $"{StorySqlHelper.BuildMeasure(lake, props.ChangeMetric)} as change_value",
        ];

        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.HealthScore, "health_score");
        StorySqlHelper.AddOptionalMeasure(selectParts, lake, props.RiskScore, "risk_score");

        string fromClause = StorySqlHelper.ApplyLatestTimeFilter(table, lake, props.TimeField);
        string selectList = string.Join(", ", selectParts);
        return $"SELECT {selectList} FROM {fromClause} GROUP BY {entityId} LIMIT 100";
    }
}
