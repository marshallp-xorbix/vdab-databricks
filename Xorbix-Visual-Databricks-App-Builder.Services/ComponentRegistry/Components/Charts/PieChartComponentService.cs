using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts;

/// <summary>
/// Service for Pie Chart component.
/// </summary>
public class PieChartComponentService : BaseComponentService, IPieChartComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.PieChart;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new PieChartComponentDto
        {
            Id = "template-piechart",
            CodeName = "templatePieChart",
            Type = ComponentType.PieChart,
            Category = ComponentCategory.Visualization,
            Icon = "PieChart",
            SchemaVersion = 1,
            Props = new PieChartProps
            {
                Title = "Pie Chart",
                SeriesColor = "#1f77b4",
                Category = new ChartAxisConfigDto
                {
                    ScaleType = "categorical",
                    Transform = "none",
                },
                Value = new ChartAxisConfigDto
                {
                    ScaleType = "continuous",
                    Transform = "sum",
                },
            },
            SupportedBindings = new List<string> { "unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling" }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        PieChartComponentDto pieChart = (PieChartComponentDto)component;
        string varName = GetVariableName(component);
        string title = pieChart.Props.Title ?? "Pie Chart";
        string codeName = component.CodeName?.Trim() ?? varName;
        string seriesColor = string.IsNullOrWhiteSpace(pieChart.Props.SeriesColor) ? "#1f77b4" : pieChart.Props.SeriesColor!;
        ChartAxisConfigDto category = pieChart.Props.Category;
        ChartAxisConfigDto value = pieChart.Props.Value;
        string? query = ChartQueryHelper.BuildGeneratedQuery(
            component,
            bindingContext => ChartAxisQueryBuilder.BuildPieOrDonutSql(bindingContext, category, value),
            out bool usesLakebase);

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, title);
        sb.AppendLine($"{indentation}st.subheader(_vdab_disp_lbl_{varName})");
        string dataIndentation = ChartQueryHelper.AppendChartDataOverridePrelude(sb, indentation, component, varName);

        if (query != null)
        {
            sb.AppendLine($"{dataIndentation}{varName}_query = \"\"\"");
            sb.AppendLine($"{dataIndentation}{query}");
            sb.AppendLine($"{dataIndentation}\"\"\"");

            if (usesLakebase)
            {
                sb.AppendLine($"{dataIndentation}{varName}_data = lakebase_query_df({varName}_query)");
            }
            else
            {
                sb.AppendLine($"{dataIndentation}{varName}_data = sql_query_df({varName}_query)");
            }

            AppendPieFigureCode(sb, indentation, varName, seriesColor);
        }

        return sb.ToString().TrimEnd();
    }

    private static string EscapePyString(string s) => s.Replace("'", "\\'", StringComparison.Ordinal);

    private static void AppendPieFigureCode(StringBuilder sb, string indentation, string varName, string seriesColor)
    {
        sb.AppendLine($"{indentation}if not {varName}_data.empty and 'category' in {varName}_data.columns and 'value' in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data[['category', 'value']].copy()");
        sb.AppendLine($"{indentation}    {varName}_data['category'] = {varName}_data['category'].astype(str)");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data[{varName}_data['category'].str.strip() != '']");
        sb.AppendLine($"{indentation}    {varName}_data['value'] = pd.to_numeric({varName}_data['value'], errors='coerce')");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data.dropna(subset=['category', 'value'])");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data[{varName}_data['value'] > 0]");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data.groupby('category', as_index=False)['value'].sum()");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data.sort_values('value', ascending=False)");
        sb.AppendLine($"{indentation}    if not {varName}_data.empty:");
        sb.AppendLine($"{indentation}        {varName}_fig = go.Figure(data=[go.Pie(labels={varName}_data['category'], values={varName}_data['value'])])");
        sb.AppendLine($"{indentation}        {varName}_fig.update_layout(colorway=['{EscapePyString(seriesColor)}'])");
        sb.AppendLine($"{indentation}        {varName}_fig.update_traces(textinfo='label', textposition='outside', hovertemplate='%{{label}}: %{{value}}<extra></extra>', sort=False)");
        sb.AppendLine($"{indentation}        {varName}_fig.update_layout(margin=dict(t=20, b=20, l=20, r=20), legend=dict(orientation='h', y=-0.15, x=0))");
        sb.AppendLine($"{indentation}        st.plotly_chart({varName}_fig, width='stretch')");
        sb.AppendLine($"{indentation}else:");
        sb.AppendLine($"{indentation}    st.info('Bind a table and configure Category and Value to render this chart.')");
    }
}
