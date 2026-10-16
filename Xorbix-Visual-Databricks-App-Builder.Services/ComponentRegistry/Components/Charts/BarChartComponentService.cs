using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts;

/// <summary>
/// Service for Bar Chart component
/// </summary>
public class BarChartComponentService : BaseComponentService, IBarChartComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.BarChart;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new BarChartComponentDto
        {
            Id = "template-barchart",
            CodeName = "templateBarChart",
            Type = ComponentType.BarChart,
            Category = ComponentCategory.Visualization,
            Icon = "BarChart",
            SchemaVersion = 1,
            Props = new BarChartProps
            {
                Title = "Bar Chart",
                SeriesColor = "#1f77b4",
                XAxis = new ChartAxisConfigDto
                {
                    ScaleType = "categorical",
                    Transform = "none",
                },
                YAxis = new ChartAxisConfigDto
                {
                    ScaleType = "continuous",
                    Transform = "count",
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
        BarChartComponentDto barChart = (BarChartComponentDto)component;

        string varName = GetVariableName(component);
        string title = barChart.Props.Title ?? "Bar Chart";
        string codeName = component.CodeName?.Trim() ?? varName;
        ChartAxisConfigDto xAxis = barChart.Props.XAxis;
        ChartAxisConfigDto yAxis = barChart.Props.YAxis;
        string xAxisTitle = ChartAxisStreamlitTitleHelper.GetTitle(xAxis, "bar-x");
        string yAxisTitle = ChartAxisStreamlitTitleHelper.GetTitle(yAxis, "bar-y");
        string seriesColor = string.IsNullOrWhiteSpace(barChart.Props.SeriesColor) ? "#1f77b4" : barChart.Props.SeriesColor!;
        string xScale = string.IsNullOrWhiteSpace(xAxis.ScaleType) ? "categorical" : xAxis.ScaleType!;
        string xTransform = string.IsNullOrWhiteSpace(xAxis.Transform) ? "none" : xAxis.Transform!;
        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, title);
        sb.AppendLine($"{indentation}st.subheader(_vdab_disp_lbl_{varName})");
        string dataIndentation = ChartQueryHelper.AppendChartDataOverridePrelude(sb, indentation, component, varName);

        string? query = ChartQueryHelper.BuildGeneratedQuery(
            component,
            bindingContext => ChartAxisQueryBuilder.BuildBarChartSql(bindingContext, xAxis, yAxis),
            out bool usesLakebase);

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
                sb.AppendLine($"{dataIndentation}# Fetch data for Bar Chart");
                sb.AppendLine($"{dataIndentation}{varName}_data = sql_query_df({varName}_query)");
            }

            AppendBarPlotCode(sb, indentation, varName, xAxisTitle, yAxisTitle, xScale, xTransform, seriesColor);
        }

        return sb.ToString().TrimEnd();
    }

    private static string EscapePyString(string s) => s.Replace("'", "\\'", StringComparison.Ordinal);

    private static void AppendBarPlotCode(
        StringBuilder sb,
        string indentation,
        string varName,
        string xAxisTitle,
        string yAxisTitle,
        string xScaleType,
        string xTransform,
        string seriesColor)
    {
        sb.AppendLine($"{indentation}if not {varName}_data.empty and 'category' in {varName}_data.columns and 'value' in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data[['category', 'value']].copy()");
        ChartStreamlitAxisFormattingHelper.AppendTemporalBucketFormatting(sb, $"{indentation}    ", varName, "category", xTransform);
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data[{varName}_data['category'].astype(str).str.strip() != '']");
        sb.AppendLine($"{indentation}    {varName}_data['value'] = pd.to_numeric({varName}_data['value'], errors='coerce')");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data.dropna(subset=['category', 'value'])");
        sb.AppendLine($"{indentation}    if not {varName}_data.empty:");
        ChartStreamlitAxisFormattingHelper.AppendResolveXAxisType(
            sb,
            $"{indentation}        ",
            varName,
            "category",
            xScaleType);
        sb.AppendLine($"{indentation}        {varName}_fig = go.Figure(data=[go.Bar(x={varName}_data['category'], y={varName}_data['value'], marker_color='{EscapePyString(seriesColor)}')])");
        sb.AppendLine($"{indentation}        {varName}_fig.update_traces(hovertemplate='%{{x}}: %{{y}}<extra></extra>')");
        sb.AppendLine($"{indentation}        {varName}_fig.update_layout(margin=dict(t=20, b=20, l=20, r=20), xaxis_title='{EscapePyString(xAxisTitle)}', yaxis_title='{EscapePyString(yAxisTitle)}', xaxis_type={varName}_xaxis_type)");
        sb.AppendLine($"{indentation}        st.plotly_chart({varName}_fig, width='stretch')");
        sb.AppendLine($"{indentation}    else:");
        sb.AppendLine($"{indentation}        st.info('No plottable rows for this bar chart after applying axis transforms.')");
        sb.AppendLine($"{indentation}else:");
        sb.AppendLine($"{indentation}    st.info('Bind a table and configure X and Y axes to render this chart.')");
    }
}
