using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds edge-list SQL for Network Web Story (one row per relationship).
/// </summary>
internal static class NetworkWebQueryBuilder
{
    public static string? BuildSql(ChartBindingContext ctx, NetworkWebStoryProps props)
    {
        if (string.IsNullOrWhiteSpace(props.SourceEntityId.Field)
            || string.IsNullOrWhiteSpace(props.SourceEntityLabel.Field)
            || string.IsNullOrWhiteSpace(props.TargetEntityId.Field)
            || string.IsNullOrWhiteSpace(props.TargetEntityLabel.Field)
            || string.IsNullOrWhiteSpace(props.RelationshipType.Field)
            || string.IsNullOrWhiteSpace(props.RelationshipWeight.Field))
        {
            return null;
        }

        bool lake = ctx.UsesLakebase;
        string table = ctx.TableReference;

        List<string> selectParts =
        [
            $"{StorySqlHelper.Quote(lake, props.SourceEntityId.Field!)} as source_entity_id",
            $"{StorySqlHelper.Quote(lake, props.SourceEntityLabel.Field!)} as source_entity_label",
            $"{StorySqlHelper.Quote(lake, props.TargetEntityId.Field!)} as target_entity_id",
            $"{StorySqlHelper.Quote(lake, props.TargetEntityLabel.Field!)} as target_entity_label",
            $"{StorySqlHelper.Quote(lake, props.RelationshipType.Field!)} as relationship_type",
            $"{StorySqlHelper.Quote(lake, props.RelationshipWeight.Field!)} as relationship_weight",
        ];

        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.Direction, "direction");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.EdgeValue, "edge_value");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.Frequency, "frequency");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.EdgeRiskScore, "edge_risk_score");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.EdgeStatus, "edge_status");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.SourceCategory, "source_category");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.TargetCategory, "target_category");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.SourceValue, "source_value");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.TargetValue, "target_value");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.SourceHealthScore, "source_health_score");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.TargetHealthScore, "target_health_score");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.SourceRiskScore, "source_risk_score");
        StorySqlHelper.AddOptionalQuoted(selectParts, lake, props.TargetRiskScore, "target_risk_score");

        string fromClause = StorySqlHelper.ApplyLatestTimeFilter(table, lake, props.TimeField);
        string selectList = string.Join(", ", selectParts);
        return $"SELECT {selectList} FROM {fromClause} LIMIT 1000";
    }
}
