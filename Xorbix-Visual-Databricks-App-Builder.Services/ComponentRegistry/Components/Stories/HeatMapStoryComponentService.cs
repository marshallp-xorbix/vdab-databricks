using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

/// <summary>
/// Service for Heat Map Story visualization component.
/// </summary>
public class HeatMapStoryComponentService : BaseComponentService, IHeatMapStoryComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.HeatMapStory;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new HeatMapStoryComponentDto
        {
            Id = "template-heatmapstory",
            CodeName = "templateHeatMapStory",
            Type = ComponentType.HeatMapStory,
            Category = ComponentCategory.Visualization,
            Icon = "HeatMapStory",
            SchemaVersion = 1,
            Props = StoryComponentDefaults.CreateHeatMapProps("Heat Map Story"),
            SupportedBindings = StoryComponentDefaults.CreateSupportedBindings(),
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        HeatMapStoryComponentDto heatMap = (HeatMapStoryComponentDto)component;
        string varName = GetVariableName(component);

        if (!StoryStreamlitGeneration.TryAppendQueryAndFetch(
                sb,
                indentation,
                component,
                varName,
                heatMap.Props.Title ?? "Heat Map Story",
                "Bind a table and map geographic area and metric fields to render this visualization.",
                bindingContext => HeatMapQueryBuilder.BuildSql(bindingContext, heatMap.Props),
                "Fetch data for Heat Map Story"))
        {
            return sb.ToString().TrimEnd();
        }

        AppendPayloadAndHtml(sb, indentation, varName, heatMap.Props);
        return sb.ToString().TrimEnd();
    }

    private static void AppendPayloadAndHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        HeatMapStoryProps props)
    {
        sb.AppendLine($"{indentation}if {varName}_data is None or {varName}_data.empty or 'area_key' not in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    st.info('No geographic areas returned. Check bindings and field mappings.')");
        sb.AppendLine($"{indentation}else:");
        StoryStreamlitGeneration.AppendNumericCoerce(
            sb,
            indentation,
            varName,
            ["metric_value", "secondary_value", "change_pct", "target_value", "risk_score", "forecast_value"]);
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.dropna(subset=['area_key'])");
        sb.AppendLine($"{indentation}    {varName}_df['metric_value'] = {varName}_df['metric_value'].fillna(0)");
        AppendRecordLoop(sb, indentation, varName);
        AppendSummaryAndPayload(sb, indentation, varName, props);
    }

    private static void AppendRecordLoop(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_records = []");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        _rec = {{");
        sb.AppendLine($"{indentation}            'area_key': '' if pd.isna(_row.get('area_key')) else str(_row.get('area_key')).strip(),");
        sb.AppendLine($"{indentation}            'metric_value': float(_row.get('metric_value') or 0),");
        sb.AppendLine($"{indentation}        }}");
        sb.AppendLine($"{indentation}        if 'secondary_value' in {varName}_df.columns and not pd.isna(_row.get('secondary_value')):");
        sb.AppendLine($"{indentation}            _rec['secondary_value'] = float(_row.get('secondary_value'))");
        sb.AppendLine($"{indentation}        if 'change_pct' in {varName}_df.columns and not pd.isna(_row.get('change_pct')):");
        sb.AppendLine($"{indentation}            _rec['change_pct'] = float(_row.get('change_pct'))");
        sb.AppendLine($"{indentation}        if 'target_value' in {varName}_df.columns and not pd.isna(_row.get('target_value')):");
        sb.AppendLine($"{indentation}            _rec['target_value'] = float(_row.get('target_value'))");
        sb.AppendLine($"{indentation}        if 'risk_score' in {varName}_df.columns and not pd.isna(_row.get('risk_score')):");
        sb.AppendLine($"{indentation}            _rec['risk_score'] = float(_row.get('risk_score'))");
        sb.AppendLine($"{indentation}        if 'category' in {varName}_df.columns and not pd.isna(_row.get('category')):");
        sb.AppendLine($"{indentation}            _rec['category'] = str(_row.get('category'))");
        sb.AppendLine($"{indentation}        if 'forecast_value' in {varName}_df.columns and not pd.isna(_row.get('forecast_value')):");
        sb.AppendLine($"{indentation}            _rec['forecast_value'] = float(_row.get('forecast_value'))");
        sb.AppendLine($"{indentation}        if 'notes' in {varName}_df.columns and not pd.isna(_row.get('notes')) and str(_row.get('notes')).strip():");
        sb.AppendLine($"{indentation}            _rec['notes'] = str(_row.get('notes')).strip()");
        sb.AppendLine($"{indentation}        {varName}_records.append(_rec)");
    }

    private static void AppendSummaryAndPayload(
        StringBuilder sb,
        string indentation,
        string varName,
        HeatMapStoryProps props)
    {
        sb.AppendLine($"{indentation}    {varName}_sorted = sorted({varName}_records, key=lambda r: r.get('metric_value', 0), reverse=True)");
        sb.AppendLine($"{indentation}    {varName}_highest = {{'area_key': {varName}_sorted[0]['area_key'], 'metric_value': {varName}_sorted[0]['metric_value']}} if {varName}_sorted else None");
        sb.AppendLine($"{indentation}    {varName}_lowest = {{'area_key': {varName}_sorted[-1]['area_key'], 'metric_value': {varName}_sorted[-1]['metric_value']}} if {varName}_sorted else None");
        sb.AppendLine($"{indentation}    {varName}_with_change = [r for r in {varName}_records if 'change_pct' in r]");
        sb.AppendLine($"{indentation}    {varName}_pos = max({varName}_with_change, key=lambda r: r.get('change_pct', 0), default=None) if {varName}_with_change else None");
        sb.AppendLine($"{indentation}    {varName}_neg = min({varName}_with_change, key=lambda r: r.get('change_pct', 0), default=None) if {varName}_with_change else None");
        sb.AppendLine($"{indentation}    {varName}_warnings = []");
        sb.AppendLine($"{indentation}    {varName}_payload = {{");
        sb.AppendLine($"{indentation}        'records': {varName}_records,");
        sb.AppendLine($"{indentation}        'visualConfig': {{");
        // MVP: only usa/state supported; props.MapScope / props.GeographicLevel are intentionally ignored here
        sb.AppendLine($"{indentation}            'map_scope': 'usa',");
        sb.AppendLine($"{indentation}            'geographic_level': 'state',");
        sb.AppendLine($"{indentation}            'color_scale': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.ColorScale, "sequential", "sequential", "diverging"))}',");
        sb.AppendLine($"{indentation}            'show_labels': {ToPythonBool(props.ShowLabels)},");
        sb.AppendLine($"{indentation}            'show_legend': {ToPythonBool(props.ShowLegend)},");
        sb.AppendLine($"{indentation}            'aggregation_method': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.AggregationMethod, "sum", "sum", "avg", "max", "min"))}',");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'summary': {{");
        sb.AppendLine($"{indentation}            'matched_areas': len({varName}_records),");
        sb.AppendLine($"{indentation}            'unmatched_keys': [],");
        sb.AppendLine($"{indentation}            'highest': {varName}_highest,");
        sb.AppendLine($"{indentation}            'lowest': {varName}_lowest,");
        sb.AppendLine($"{indentation}            'largest_positive_change': ({{'area_key': {varName}_pos['area_key'], 'change_pct': {varName}_pos['change_pct']}} if {varName}_pos else None),");
        sb.AppendLine($"{indentation}            'largest_negative_change': ({{'area_key': {varName}_neg['area_key'], 'change_pct': {varName}_neg['change_pct']}} if {varName}_neg else None),");
        sb.AppendLine($"{indentation}            'warnings': {varName}_warnings,");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}    }}");
        StoryStreamlitGeneration.AppendComponentsHtml(
            sb,
            indentation,
            varName,
            HeatMapStreamlitHtmlHelper.GetHtmlTemplatePythonLiteral(),
            HeatMapStreamlitHtmlHelper.PayloadPlaceholder,
            HeatMapStreamlitHtmlHelper.DefaultHeightPx);
    }
}
