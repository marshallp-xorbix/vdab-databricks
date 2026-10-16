using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

/// <summary>
/// Service for Pulse Wave Story visualization component.
/// </summary>
public class PulseWaveStoryComponentService : BaseComponentService, IPulseWaveStoryComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.PulseWaveStory;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new PulseWaveStoryComponentDto
        {
            Id = "template-pulsewavestory",
            CodeName = "templatePulseWaveStory",
            Type = ComponentType.PulseWaveStory,
            Category = ComponentCategory.Visualization,
            Icon = "PulseWaveStory",
            SchemaVersion = 1,
            Props = StoryComponentDefaults.CreatePulseWaveProps("Pulse Wave Story"),
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
        PulseWaveStoryComponentDto pulseWave = (PulseWaveStoryComponentDto)component;
        string varName = GetVariableName(component);

        if (!StoryStreamlitGeneration.TryAppendQueryAndFetch(
                sb,
                indentation,
                component,
                varName,
                pulseWave.Props.Title ?? "Pulse Wave Story",
                "Bind a table and map time, metric, and baseline fields to render this visualization.",
                bindingContext => PulseWaveQueryBuilder.BuildSql(bindingContext, pulseWave.Props),
                "Fetch data for Pulse Wave Story"))
        {
            return sb.ToString().TrimEnd();
        }

        AppendPayloadAndHtml(sb, indentation, varName, pulseWave.Props);
        return sb.ToString().TrimEnd();
    }

    private static void AppendPayloadAndHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        PulseWaveStoryProps props)
    {
        sb.AppendLine($"{indentation}if {varName}_data is None or {varName}_data.empty or 'time_period' not in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    st.info('No time-series points returned. Check bindings and field mappings.')");
        sb.AppendLine($"{indentation}else:");
        StoryStreamlitGeneration.AppendNumericCoerce(
            sb,
            indentation,
            varName,
            ["metric_value", "baseline_value", "impact_score"]);
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.dropna(subset=['time_period'])");
        sb.AppendLine($"{indentation}    {varName}_df['metric_value'] = {varName}_df['metric_value'].fillna(0)");
        sb.AppendLine($"{indentation}    {varName}_df['baseline_value'] = {varName}_df['baseline_value'].fillna(0)");
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.sort_values(by='time_period')");
        AppendRecordAndEventLoops(sb, indentation, varName);
        AppendSpikeDropSummary(sb, indentation, varName);
        AppendPayload(sb, indentation, varName, props);
    }

    private static void AppendRecordAndEventLoops(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_records = []");
        sb.AppendLine($"{indentation}    {varName}_events = []");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        _period = '' if pd.isna(_row.get('time_period')) else str(_row.get('time_period')).strip()");
        sb.AppendLine($"{indentation}        _rec = {{");
        sb.AppendLine($"{indentation}            'time_period': _period,");
        sb.AppendLine($"{indentation}            'metric_value': float(_row.get('metric_value') or 0),");
        sb.AppendLine($"{indentation}            'baseline_value': float(_row.get('baseline_value') or 0),");
        sb.AppendLine($"{indentation}        }}");
        sb.AppendLine($"{indentation}        {varName}_records.append(_rec)");
        sb.AppendLine($"{indentation}        if 'event_name' in {varName}_df.columns and not pd.isna(_row.get('event_name')) and str(_row.get('event_name')).strip():");
        sb.AppendLine($"{indentation}            _evt = {{");
        sb.AppendLine($"{indentation}                'time_period': _period,");
        sb.AppendLine($"{indentation}                'event_name': str(_row.get('event_name')).strip(),");
        sb.AppendLine($"{indentation}            }}");
        sb.AppendLine($"{indentation}            if 'event_type' in {varName}_df.columns and not pd.isna(_row.get('event_type')) and str(_row.get('event_type')).strip():");
        sb.AppendLine($"{indentation}                _evt['event_type'] = str(_row.get('event_type')).strip().lower()");
        sb.AppendLine($"{indentation}            if 'impact_score' in {varName}_df.columns and not pd.isna(_row.get('impact_score')):");
        sb.AppendLine($"{indentation}                _evt['impact_score'] = float(_row.get('impact_score'))");
        sb.AppendLine($"{indentation}            {varName}_events.append(_evt)");
    }

    private static void AppendSpikeDropSummary(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_spike = None");
        sb.AppendLine($"{indentation}    {varName}_drop = None");
        sb.AppendLine($"{indentation}    for _i in range(1, len({varName}_records)):");
        sb.AppendLine($"{indentation}        _delta = {varName}_records[_i]['metric_value'] - {varName}_records[_i - 1]['metric_value']");
        sb.AppendLine($"{indentation}        _point = {{'time_period': {varName}_records[_i]['time_period'], 'delta': _delta}}");
        sb.AppendLine($"{indentation}        if {varName}_spike is None or _delta > {varName}_spike['delta']:");
        sb.AppendLine($"{indentation}            {varName}_spike = _point");
        sb.AppendLine($"{indentation}        if {varName}_drop is None or _delta < {varName}_drop['delta']:");
        sb.AppendLine($"{indentation}            {varName}_drop = _point");
        sb.AppendLine($"{indentation}    {varName}_warnings = []");
        sb.AppendLine($"{indentation}    if len({varName}_records) < 8:");
        sb.AppendLine($"{indentation}        {varName}_warnings.append('Fewer than 8 time points — wave may be less meaningful.')");
    }

    private static void AppendPayload(
        StringBuilder sb,
        string indentation,
        string varName,
        PulseWaveStoryProps props)
    {
        string metricName = EscapePythonSingleQuoted(
            string.IsNullOrWhiteSpace(props.MetricName) ? "Metric" : props.MetricName.Trim());
        string yAxisLabel = EscapePythonSingleQuoted(
            !string.IsNullOrWhiteSpace(props.MetricValue.Field)
                ? props.MetricValue.Field.Trim()
                : (string.IsNullOrWhiteSpace(props.MetricName) ? "Metric" : props.MetricName.Trim()));
        sb.AppendLine($"{indentation}    {varName}_payload = {{");
        sb.AppendLine($"{indentation}        'records': {varName}_records,");
        sb.AppendLine($"{indentation}        'events': {varName}_events,");
        sb.AppendLine($"{indentation}        'visualConfig': {{");
        sb.AppendLine($"{indentation}            'metric_name': '{metricName}',");
        sb.AppendLine($"{indentation}            'y_axis_label': '{yAxisLabel}',");
        sb.AppendLine($"{indentation}            'aggregation_method': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.AggregationMethod, "sum", "sum", "avg", "max", "min"))}',");
        sb.AppendLine($"{indentation}            'show_baseline': {ToPythonBool(props.ShowBaseline)},");
        sb.AppendLine($"{indentation}            'show_events': {ToPythonBool(props.ShowEvents)},");
        sb.AppendLine($"{indentation}            'show_anomaly_markers': {ToPythonBool(props.ShowAnomalyMarkers)},");
        sb.AppendLine($"{indentation}            'fill_under_wave': {ToPythonBool(props.FillUnderWave)},");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'summary': {{");
        sb.AppendLine($"{indentation}            'point_count': len({varName}_records),");
        sb.AppendLine($"{indentation}            'largest_spike': {varName}_spike,");
        sb.AppendLine($"{indentation}            'largest_drop': {varName}_drop,");
        sb.AppendLine($"{indentation}            'event_count': len({varName}_events),");
        sb.AppendLine($"{indentation}            'warnings': {varName}_warnings,");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}    }}");
        StoryStreamlitGeneration.AppendComponentsHtml(
            sb,
            indentation,
            varName,
            PulseWaveStreamlitHtmlHelper.GetHtmlTemplatePythonLiteral(),
            PulseWaveStreamlitHtmlHelper.PayloadPlaceholder,
            PulseWaveStreamlitHtmlHelper.DefaultHeightPx);
    }
}
