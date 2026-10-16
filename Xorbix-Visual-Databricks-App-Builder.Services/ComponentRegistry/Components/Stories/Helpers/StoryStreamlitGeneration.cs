using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Shared Streamlit code-generation scaffolding for story visualizations.
/// </summary>
internal static class StoryStreamlitGeneration
{
    /// <summary>
    /// Appends title, query, and data-fetch lines. Returns <c>false</c> when no binding/query
    /// (empty-info already written; caller should return).
    /// </summary>
    public static bool TryAppendQueryAndFetch(
        StringBuilder sb,
        string indentation,
        VdabComponentDto component,
        string varName,
        string title,
        string emptyBindingMessage,
        Func<ChartBindingContext, string?> buildSql,
        string fetchComment)
    {
        string codeName = component.CodeName?.Trim() ?? varName;
        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, title);
        sb.AppendLine($"{indentation}st.subheader(_vdab_disp_lbl_{varName})");

        string? query = ChartQueryHelper.BuildGeneratedQuery(component, buildSql, out bool usesLakebase);
        if (query == null)
        {
            sb.AppendLine($"{indentation}st.info('{emptyBindingMessage}')");
            return false;
        }

        sb.AppendLine($"{indentation}{varName}_query = \"\"\"");
        sb.AppendLine($"{indentation}{query}");
        sb.AppendLine($"{indentation}\"\"\"");

        if (usesLakebase)
        {
            sb.AppendLine($"{indentation}{varName}_data = lakebase_query_df({varName}_query)");
        }
        else
        {
            sb.AppendLine($"{indentation}# {fetchComment}");
            sb.AppendLine($"{indentation}{varName}_data = sql_query_df({varName}_query)");
        }

        return true;
    }

    /// <summary>
    /// Coerces listed DataFrame columns to numeric (in-place).
    /// </summary>
    public static void AppendNumericCoerce(
        StringBuilder sb,
        string indentation,
        string varName,
        IReadOnlyList<string> columns)
    {
        string listLiteral = string.Join(", ", columns.Select(c => $"'{c}'"));
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_data.copy()");
        sb.AppendLine($"{indentation}    for _col in [{listLiteral}]:");
        sb.AppendLine($"{indentation}        if _col in {varName}_df.columns:");
        sb.AppendLine($"{indentation}            {varName}_df[_col] = pd.to_numeric({varName}_df[_col], errors='coerce')");
    }

    /// <summary>
    /// Injects the HTML template with <c>{var}_payload</c> and renders via components.html.
    /// </summary>
    public static void AppendComponentsHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        string htmlPythonLiteral,
        string payloadPlaceholder,
        int heightPx)
    {
        sb.AppendLine($"{indentation}    {varName}_html = '''{htmlPythonLiteral}'''");
        sb.AppendLine($"{indentation}    {varName}_html = {varName}_html.replace('{payloadPlaceholder}', json.dumps({varName}_payload, default=str))");
        sb.AppendLine($"{indentation}    components.html({varName}_html, height={heightPx}, scrolling=False)");
    }
}
