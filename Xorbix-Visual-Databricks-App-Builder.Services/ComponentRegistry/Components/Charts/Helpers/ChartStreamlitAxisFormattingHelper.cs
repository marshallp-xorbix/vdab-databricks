using System.Text;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;

internal static class ChartStreamlitAxisFormattingHelper
{
    /// <summary>
    /// Emits pandas code that formats a chart dimension column into temporal bucket labels
    /// (year / month / week / day). No-ops when the transform is not a temporal bucket so
    /// numeric or categorical X values (e.g. user_id) are left alone for Plotly.
    /// </summary>
    public static void AppendTemporalBucketFormatting(
        StringBuilder sb,
        string indentation,
        string varName,
        string dimensionColumnName,
        string transform)
    {
        string normalizedTransform = string.IsNullOrWhiteSpace(transform)
            ? "none"
            : transform.Trim().ToLowerInvariant();

        if (normalizedTransform is not ("yearly" or "monthly" or "weekly" or "daily"))
        {
            return;
        }

        sb.AppendLine($"{indentation}{varName}_x_dt = pd.to_datetime({varName}_data['{dimensionColumnName}'], errors='coerce')");
        sb.AppendLine($"{indentation}if {varName}_x_dt.notna().any():");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data[{varName}_x_dt.notna()].copy()");
        sb.AppendLine($"{indentation}    {varName}_data['_x_dt'] = pd.to_datetime({varName}_data['{dimensionColumnName}'], errors='coerce')");
        sb.AppendLine($"{indentation}    if '{normalizedTransform}' == 'yearly':");
        sb.AppendLine($"{indentation}        {varName}_data['{dimensionColumnName}'] = {varName}_data['_x_dt'].dt.strftime('%Y')");
        sb.AppendLine($"{indentation}    elif '{normalizedTransform}' == 'monthly':");
        sb.AppendLine($"{indentation}        {varName}_data['{dimensionColumnName}'] = {varName}_data['_x_dt'].dt.strftime('%Y-%m')");
        sb.AppendLine($"{indentation}    elif '{normalizedTransform}' == 'weekly':");
        sb.AppendLine($"{indentation}        {varName}_iso = {varName}_data['_x_dt'].dt.isocalendar()");
        sb.AppendLine($"{indentation}        {varName}_data['{dimensionColumnName}'] = {varName}_iso['year'].astype(str) + '-W' + {varName}_iso['week'].astype(str).str.zfill(2)");
        sb.AppendLine($"{indentation}    elif '{normalizedTransform}' == 'daily':");
        sb.AppendLine($"{indentation}        {varName}_data['{dimensionColumnName}'] = {varName}_data['_x_dt'].dt.strftime('%Y-%m-%d')");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data.sort_values(by='_x_dt')");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data.drop(columns=['_x_dt'])");
        sb.AppendLine($"{indentation}else:");
        sb.AppendLine($"{indentation}    {varName}_data['{dimensionColumnName}'] = {varName}_data['{dimensionColumnName}'].astype(str)");
    }

    /// <summary>
    /// Emits code that picks Plotly x-axis type from the configured scale and actual X values.
    /// Continuous axes fall back to category when X is not fully numeric (e.g. UUID user_id),
    /// which otherwise produces an empty scatter on a linear axis.
    /// </summary>
    public static void AppendResolveXAxisType(
        StringBuilder sb,
        string indentation,
        string varName,
        string dimensionColumnName,
        string xScaleType)
    {
        bool preferCategory = string.Equals(xScaleType, "categorical", StringComparison.OrdinalIgnoreCase);

        if (preferCategory)
        {
            sb.AppendLine($"{indentation}{varName}_data['{dimensionColumnName}'] = {varName}_data['{dimensionColumnName}'].astype(str)");
            sb.AppendLine($"{indentation}{varName}_xaxis_type = 'category'");
            return;
        }

        sb.AppendLine($"{indentation}{varName}_x_num = pd.to_numeric({varName}_data['{dimensionColumnName}'], errors='coerce')");
        sb.AppendLine($"{indentation}if {varName}_x_num.notna().all():");
        sb.AppendLine($"{indentation}    {varName}_data['{dimensionColumnName}'] = {varName}_x_num");
        sb.AppendLine($"{indentation}    {varName}_xaxis_type = 'linear'");
        sb.AppendLine($"{indentation}else:");
        sb.AppendLine($"{indentation}    {varName}_data['{dimensionColumnName}'] = {varName}_data['{dimensionColumnName}'].astype(str)");
        sb.AppendLine($"{indentation}    {varName}_xaxis_type = 'category'");
    }
}
