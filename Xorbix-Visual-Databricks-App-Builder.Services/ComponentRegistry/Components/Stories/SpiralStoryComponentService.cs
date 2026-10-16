using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

/// <summary>
/// Service for Spiral Story visualization component.
/// </summary>
public class SpiralStoryComponentService : BaseComponentService, ISpiralStoryComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.SpiralStory;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new SpiralStoryComponentDto
        {
            Id = "template-spiralstory",
            CodeName = "templateSpiralStory",
            Type = ComponentType.SpiralStory,
            Category = ComponentCategory.Visualization,
            Icon = "SpiralStory",
            SchemaVersion = 1,
            Props = StoryComponentDefaults.CreateSpiralProps("Spiral Story"),
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
        SpiralStoryComponentDto spiral = (SpiralStoryComponentDto)component;
        string varName = GetVariableName(component);

        if (!StoryStreamlitGeneration.TryAppendQueryAndFetch(
                sb,
                indentation,
                component,
                varName,
                spiral.Props.Title ?? "Spiral Story",
                "Bind a table and map journey, stage, timeline, progress, and metric fields to render this visualization.",
                bindingContext => SpiralQueryBuilder.BuildSql(bindingContext, spiral.Props),
                "Fetch data for Spiral Story"))
        {
            return sb.ToString().TrimEnd();
        }

        AppendPayloadAndHtml(sb, indentation, varName, spiral.Props);
        return sb.ToString().TrimEnd();
    }

    private static void AppendPayloadAndHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        SpiralStoryProps props)
    {
        sb.AppendLine($"{indentation}if {varName}_data is None or {varName}_data.empty or 'journey_name' not in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    st.info('No spiral records returned. Check bindings and field mappings.')");
        sb.AppendLine($"{indentation}else:");
        StoryStreamlitGeneration.AppendNumericCoerce(
            sb,
            indentation,
            varName,
            ["progress_pct", "metric_value", "risk_score", "cost"]);
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.dropna(subset=['journey_name', 'stage'])");
        AppendRecordLoop(sb, indentation, varName);
        AppendJourneySelection(sb, indentation, varName);
        AppendPayload(sb, indentation, varName, props);
    }

    private static void AppendRecordLoop(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_all = []");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        _journey = '' if pd.isna(_row.get('journey_name')) else str(_row.get('journey_name')).strip()");
        sb.AppendLine($"{indentation}        _stage = '' if pd.isna(_row.get('stage')) else str(_row.get('stage')).strip()");
        sb.AppendLine($"{indentation}        if not _journey or not _stage:");
        sb.AppendLine($"{indentation}            continue");
        sb.AppendLine($"{indentation}        _rec = {{");
        sb.AppendLine($"{indentation}            'journey_name': _journey,");
        sb.AppendLine($"{indentation}            'stage': _stage,");
        sb.AppendLine($"{indentation}            'timeline': None if pd.isna(_row.get('timeline')) else str(_row.get('timeline')),");
        sb.AppendLine($"{indentation}            'progress_pct': float(_row.get('progress_pct') or 0),");
        sb.AppendLine($"{indentation}            'metric_value': float(_row.get('metric_value') or 0),");
        sb.AppendLine($"{indentation}        }}");
        sb.AppendLine($"{indentation}        if 'target_date' in {varName}_df.columns and not pd.isna(_row.get('target_date')):");
        sb.AppendLine($"{indentation}            _rec['target_date'] = str(_row.get('target_date'))");
        sb.AppendLine($"{indentation}        if 'actual_date' in {varName}_df.columns and not pd.isna(_row.get('actual_date')):");
        sb.AppendLine($"{indentation}            _rec['actual_date'] = str(_row.get('actual_date'))");
        sb.AppendLine($"{indentation}        if 'status' in {varName}_df.columns and not pd.isna(_row.get('status')) and str(_row.get('status')).strip():");
        sb.AppendLine($"{indentation}            _rec['status'] = str(_row.get('status')).strip().lower().replace(' ', '_')");
        sb.AppendLine($"{indentation}        if 'risk_score' in {varName}_df.columns and not pd.isna(_row.get('risk_score')):");
        sb.AppendLine($"{indentation}            _rec['risk_score'] = float(_row.get('risk_score'))");
        sb.AppendLine($"{indentation}        if 'owner' in {varName}_df.columns and not pd.isna(_row.get('owner')) and str(_row.get('owner')).strip():");
        sb.AppendLine($"{indentation}            _rec['owner'] = str(_row.get('owner')).strip()");
        sb.AppendLine($"{indentation}        if 'key_achievement' in {varName}_df.columns and not pd.isna(_row.get('key_achievement')) and str(_row.get('key_achievement')).strip():");
        sb.AppendLine($"{indentation}            _rec['key_achievement'] = str(_row.get('key_achievement')).strip()");
        sb.AppendLine($"{indentation}        if 'cost' in {varName}_df.columns and not pd.isna(_row.get('cost')):");
        sb.AppendLine($"{indentation}            _rec['cost'] = float(_row.get('cost'))");
        sb.AppendLine($"{indentation}        if 'target_date' in _rec and 'actual_date' in _rec:");
        sb.AppendLine($"{indentation}            try:");
        sb.AppendLine($"{indentation}                _tgt = pd.to_datetime(_rec['target_date'], errors='coerce')");
        sb.AppendLine($"{indentation}                _act = pd.to_datetime(_rec['actual_date'], errors='coerce')");
        sb.AppendLine($"{indentation}                if pd.notna(_tgt) and pd.notna(_act):");
        sb.AppendLine($"{indentation}                    _rec['schedule_variance_days'] = int((_act - _tgt).days)");
        sb.AppendLine($"{indentation}            except Exception:");
        sb.AppendLine($"{indentation}                pass");
        sb.AppendLine($"{indentation}        {varName}_all.append(_rec)");
    }

    private static void AppendJourneySelection(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_by_journey = {{}}");
        sb.AppendLine($"{indentation}    for _r in {varName}_all:");
        sb.AppendLine($"{indentation}        {varName}_by_journey.setdefault(_r['journey_name'], []).append(_r)");
        sb.AppendLine($"{indentation}    {varName}_journeys = sorted({varName}_by_journey.keys())");
        sb.AppendLine($"{indentation}    if not {varName}_journeys:");
        sb.AppendLine($"{indentation}        st.info('No spiral milestones after filtering.')");
        sb.AppendLine($"{indentation}        {varName}_records = []");
        sb.AppendLine($"{indentation}        {varName}_selected = ''");
        sb.AppendLine($"{indentation}    else:");
        sb.AppendLine($"{indentation}        {varName}_selected = sorted({varName}_journeys, key=lambda j: (-len({varName}_by_journey[j]), j))[0]");
        sb.AppendLine($"{indentation}        {varName}_records = list({varName}_all)");
        sb.AppendLine($"{indentation}    {varName}_warnings = []");
        sb.AppendLine($"{indentation}    {varName}_selected_recs = [r for r in {varName}_records if r.get('journey_name') == {varName}_selected]");
        sb.AppendLine($"{indentation}    if {varName}_selected_recs and len({varName}_selected_recs) < 3:");
        sb.AppendLine($"{indentation}        {varName}_warnings.append('Fewer than 3 milestones — spiral story may be less meaningful.')");
    }

    private static void AppendPayload(
        StringBuilder sb,
        string indentation,
        string varName,
        SpiralStoryProps props)
    {
        sb.AppendLine($"{indentation}    {varName}_payload = {{");
        sb.AppendLine($"{indentation}        'records': {varName}_records,");
        sb.AppendLine($"{indentation}        'journeys': {varName}_journeys,");
        sb.AppendLine($"{indentation}        'selected_journey': {varName}_selected,");
        sb.AppendLine($"{indentation}        'visualConfig': {{");
        sb.AppendLine($"{indentation}            'show_labels': {ToPythonBool(props.ShowLabels)},");
        sb.AppendLine($"{indentation}            'show_risk_glow': {ToPythonBool(props.ShowRiskGlow)},");
        sb.AppendLine($"{indentation}            'show_variance': {ToPythonBool(props.ShowVariance)},");
        sb.AppendLine($"{indentation}            'space_by_timeline': {ToPythonBool(props.SpaceByTimeline)},");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'summary': {{");
        sb.AppendLine($"{indentation}            'journey_name': {varName}_selected,");
        sb.AppendLine($"{indentation}            'milestone_count': len({varName}_selected_recs),");
        sb.AppendLine($"{indentation}            'warnings': {varName}_warnings,");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}    }}");
        StoryStreamlitGeneration.AppendComponentsHtml(
            sb,
            indentation,
            varName,
            SpiralStreamlitHtmlHelper.GetHtmlTemplatePythonLiteral(),
            SpiralStreamlitHtmlHelper.PayloadPlaceholder,
            SpiralStreamlitHtmlHelper.DefaultHeightPx);
    }
}
