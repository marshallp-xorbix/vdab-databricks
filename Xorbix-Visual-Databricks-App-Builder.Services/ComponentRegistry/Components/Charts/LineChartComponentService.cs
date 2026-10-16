using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts.Helpers;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts;

/// <summary>
/// Service for Line Chart component
/// </summary>
public class LineChartComponentService : BaseComponentService, ILineChartComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.LineChart;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new LineChartComponentDto
        {
            Id = "template-linechart",
            CodeName = "templateLineChart",
            Type = ComponentType.LineChart,
            Category = ComponentCategory.Visualization,
            Icon = "LineChart",
            SchemaVersion = 1,
            Props = new LineChartProps
            {
                Title = "Line Chart",
                SeriesColor = "#1f77b4",
                XAxis = new ChartAxisConfigDto
                {
                    ScaleType = "continuous",
                    Transform = "none",
                },
                YAxis = new ChartAxisConfigDto
                {
                    ScaleType = "continuous",
                    Transform = "none",
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
        LineChartComponentDto lineChart = (LineChartComponentDto)component;
        string varName = GetVariableName(component);
        string title = lineChart.Props.Title ?? "Line Chart";
        string codeName = component.CodeName?.Trim() ?? varName;
        ChartAxisConfigDto xAxis = lineChart.Props.XAxis;
        ChartAxisConfigDto yAxis = lineChart.Props.YAxis;
        string xAxisTitle = ChartAxisStreamlitTitleHelper.GetTitle(xAxis, "line-x");
        string yAxisTitle = ChartAxisStreamlitTitleHelper.GetTitle(yAxis, "line-y");
        string seriesColor = string.IsNullOrWhiteSpace(lineChart.Props.SeriesColor) ? "#1f77b4" : lineChart.Props.SeriesColor!;
        string xScale = string.IsNullOrWhiteSpace(xAxis.ScaleType) ? "continuous" : xAxis.ScaleType!;
        string xTransform = string.IsNullOrWhiteSpace(xAxis.Transform) ? "none" : xAxis.Transform!;
        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, title);
        sb.AppendLine($"{indentation}st.subheader(_vdab_disp_lbl_{varName})");
        string dataIndentation = ChartQueryHelper.AppendChartDataOverridePrelude(sb, indentation, component, varName);

        string? query = ChartQueryHelper.BuildGeneratedQuery(
            component,
            bindingContext => ChartAxisQueryBuilder.BuildLineChartSql(bindingContext, xAxis, yAxis),
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
                sb.AppendLine($"{dataIndentation}# Fetch data for Line Chart");
                sb.AppendLine($"{dataIndentation}{varName}_data = sql_query_df({varName}_query)");
            }

            AppendLinePlotCode(sb, indentation, varName, xAxisTitle, yAxisTitle, xScale, xTransform, seriesColor);
        }

        return sb.ToString().TrimEnd();
    }

    private static string EscapePyString(string s) => s.Replace("'", "\\'", StringComparison.Ordinal);

    private static void AppendLinePlotCode(
        StringBuilder sb,
        string indentation,
        string varName,
        string xAxisTitle,
        string yAxisTitle,
        string xScaleType,
        string xTransform,
        string seriesColor)
    {
        sb.AppendLine($"{indentation}if not {varName}_data.empty and 'x' in {varName}_data.columns and 'y' in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data[['x', 'y']].copy()");
        ChartStreamlitAxisFormattingHelper.AppendTemporalBucketFormatting(sb, $"{indentation}    ", varName, "x", xTransform);
        sb.AppendLine($"{indentation}    {varName}_data['y'] = pd.to_numeric({varName}_data['y'], errors='coerce')");
        sb.AppendLine($"{indentation}    {varName}_data = {varName}_data.dropna(subset=['x', 'y'])");
        sb.AppendLine($"{indentation}    if not {varName}_data.empty:");
        ChartStreamlitAxisFormattingHelper.AppendResolveXAxisType(
            sb,
            $"{indentation}        ",
            varName,
            "x",
            xScaleType);
        sb.AppendLine($"{indentation}        {varName}_fig = go.Figure(data=[go.Scatter(x={varName}_data['x'], y={varName}_data['y'], mode='lines+markers', line=dict(color='{EscapePyString(seriesColor)}', width=2), marker=dict(color='{EscapePyString(seriesColor)}', size=6))])");
        sb.AppendLine($"{indentation}        {varName}_fig.update_traces(hovertemplate='%{{x}}, %{{y}}<extra></extra>')");
        sb.AppendLine($"{indentation}        {varName}_fig.update_layout(margin=dict(t=20, b=20, l=20, r=20), xaxis_title='{EscapePyString(xAxisTitle)}', yaxis_title='{EscapePyString(yAxisTitle)}', xaxis=dict(type={varName}_xaxis_type))");
        sb.AppendLine($"{indentation}        st.plotly_chart({varName}_fig, width='stretch')");
        sb.AppendLine($"{indentation}    else:");
        sb.AppendLine($"{indentation}        st.info('No plottable rows for this line chart after applying axis transforms.')");
        sb.AppendLine($"{indentation}else:");
        sb.AppendLine($"{indentation}    st.info('Bind a table and configure X and Y axes to render this chart.')");
    }
}
