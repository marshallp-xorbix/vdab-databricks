using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

internal static class ChartAxisQueryBuilder
{
    public static string QuoteIdent(bool usesLakebase, string name) =>
        ChartSqlDialectHelper.QuoteIdent(usesLakebase, name);

    public static string? BuildBarChartSql(
        ChartBindingContext ctx,
        ChartAxisConfigDto x,
        ChartAxisConfigDto y)
    {
        if (string.IsNullOrWhiteSpace(x.Field))
        {
            return null;
        }

        string xExpr = BuildDimensionExpression(ctx.UsesLakebase, x.Field!, x.Transform);
        string table = ctx.TableReference;
        string? yExpr = BuildBarMeasureExpression(ctx.UsesLakebase, y);
        if (yExpr == null)
        {
            return null;
        }

        return $"SELECT {xExpr} as category, {yExpr} as value FROM {table} GROUP BY {xExpr}";
    }

    private static string? BuildBarMeasureExpression(bool usesLakebase, ChartAxisConfigDto y)
    {
        string transform = (y.Transform ?? "none").Trim().ToLowerInvariant();
        bool hasField = !string.IsNullOrWhiteSpace(y.Field);
        string? yq = hasField ? QuoteIdent(usesLakebase, y.Field!) : null;

        if (transform == "count" && !hasField)
        {
            return "COUNT(*)";
        }

        if (!hasField)
        {
            return null;
        }

        return transform switch
        {
            "count" => $"COUNT({yq})",
            "count_distinct" => $"COUNT(DISTINCT {yq})",
            "avg" => $"AVG({yq})",
            "min" => $"MIN({yq})",
            "max" => $"MAX({yq})",
            "sum" or "none" => $"SUM({yq})",
            _ => $"SUM({yq})"
        };
    }

    public static string? BuildLineChartSql(
        ChartBindingContext ctx,
        ChartAxisConfigDto x,
        ChartAxisConfigDto y)
    {
        if (string.IsNullOrWhiteSpace(x.Field) || string.IsNullOrWhiteSpace(y.Field))
        {
            return null;
        }

        string xExpr = BuildDimensionExpression(ctx.UsesLakebase, x.Field!, x.Transform);
        string yq = QuoteIdent(ctx.UsesLakebase, y.Field!);
        string table = ctx.TableReference;

        string yt = (y.Transform ?? "none").Trim().ToLowerInvariant();
        bool yNeedsAgg = yt is not ("" or "none");

        if (!yNeedsAgg)
        {
            return $"SELECT {xExpr} as x, {yq} as y FROM {table} ORDER BY {xExpr}";
        }

        string? yExpr = BuildLineMeasureExpression(ctx.UsesLakebase, y);
        if (yExpr == null)
        {
            return null;
        }

        return $"SELECT {xExpr} as x, {yExpr} as y FROM {table} GROUP BY {xExpr} ORDER BY {xExpr}";
    }

    private static string? BuildLineMeasureExpression(bool usesLakebase, ChartAxisConfigDto y)
    {
        string transform = (y.Transform ?? "none").Trim().ToLowerInvariant();
        string yq = QuoteIdent(usesLakebase, y.Field!);

        if (transform is "count" && string.IsNullOrWhiteSpace(y.Field))
        {
            return "COUNT(*)";
        }

        if (string.IsNullOrWhiteSpace(y.Field))
        {
            return null;
        }

        return transform switch
        {
            "none" or "" => yq,
            "count" => $"COUNT({yq})",
            "count_distinct" => $"COUNT(DISTINCT {yq})",
            "avg" => $"AVG({yq})",
            "min" => $"MIN({yq})",
            "max" => $"MAX({yq})",
            "sum" => $"SUM({yq})",
            _ => yq
        };
    }

    public static string? BuildPieOrDonutSql(
        ChartBindingContext ctx,
        ChartAxisConfigDto category,
        ChartAxisConfigDto value)
    {
        if (string.IsNullOrWhiteSpace(category.Field) || string.IsNullOrWhiteSpace(value.Field))
        {
            return null;
        }

        string cq = BuildDimensionExpression(ctx.UsesLakebase, category.Field!, category.Transform);
        string vq = QuoteIdent(ctx.UsesLakebase, value.Field!);
        string table = ctx.TableReference;
        string vt = (value.Transform ?? "none").Trim().ToLowerInvariant();

        if (vt is "" or "none")
        {
            return $"SELECT {cq} as category, {vq} as value FROM {table}";
        }

        string agg = vt switch
        {
            "sum" => $"SUM({vq})",
            "avg" => $"AVG({vq})",
            "min" => $"MIN({vq})",
            "max" => $"MAX({vq})",
            "count" => $"COUNT({vq})",
            "count_distinct" => $"COUNT(DISTINCT {vq})",
            _ => $"SUM({vq})"
        };

        return $"SELECT {cq} as category, {agg} as value FROM {table} GROUP BY {cq}";
    }

    private static string BuildDimensionExpression(
        bool usesLakebase,
        string fieldName,
        string? transform)
    {
        string quoted = QuoteIdent(usesLakebase, fieldName);
        return ChartSqlDialectHelper.BuildDateTruncExpression(usesLakebase, quoted, transform);
    }
}
