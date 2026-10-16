namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

internal static class ChartSqlDialectHelper
{
    public static string QuoteIdent(bool usesLakebase, string name) =>
        usesLakebase
            ? $"\"{name.Replace("\"", "\"\"", StringComparison.Ordinal)}\""
            : $"`{name.Replace("`", "``", StringComparison.Ordinal)}`";

    public static string BuildDateTruncExpression(
        bool usesLakebase,
        string quotedFieldName,
        string? transform)
    {
        string normalized = (transform ?? "none").Trim().ToLowerInvariant();
        string? unit = normalized switch
        {
            "yearly" => "year",
            "monthly" => "month",
            "weekly" => "week",
            "daily" => "day",
            _ => null
        };

        return string.IsNullOrWhiteSpace(unit)
            ? quotedFieldName
            : $"DATE_TRUNC('{unit}', {quotedFieldName})";
    }
}
