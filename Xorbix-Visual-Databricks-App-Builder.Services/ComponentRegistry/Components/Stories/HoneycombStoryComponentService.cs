using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

/// <summary>
/// Service for Honeycomb Story visualization component.
/// </summary>
public class HoneycombStoryComponentService : BaseComponentService, IHoneycombStoryComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.HoneycombStory;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new HoneycombStoryComponentDto
        {
            Id = "template-honeycombstory",
            CodeName = "templateHoneycombStory",
            Type = ComponentType.HoneycombStory,
            Category = ComponentCategory.Visualization,
            Icon = "HoneycombStory",
            SchemaVersion = 1,
            Props = StoryComponentDefaults.CreateHoneycombProps("Honeycomb Story"),
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
        HoneycombStoryComponentDto honeycomb = (HoneycombStoryComponentDto)component;
        string varName = GetVariableName(component);

        if (!StoryStreamlitGeneration.TryAppendQueryAndFetch(
                sb,
                indentation,
                component,
                varName,
                honeycomb.Props.Title ?? "Honeycomb Story",
                "Bind a table and map item, impact, priority, progress, and category fields to render this visualization.",
                bindingContext => HoneycombQueryBuilder.BuildSql(bindingContext, honeycomb.Props),
                "Fetch data for Honeycomb Story"))
        {
            return sb.ToString().TrimEnd();
        }

        AppendPayloadAndHtml(sb, indentation, varName, honeycomb.Props);
        return sb.ToString().TrimEnd();
    }

    private static void AppendPayloadAndHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        HoneycombStoryProps props)
    {
        sb.AppendLine($"{indentation}if {varName}_data is None or {varName}_data.empty or 'item_name' not in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    st.info('No honeycomb records returned. Check bindings and field mappings.')");
        sb.AppendLine($"{indentation}else:");
        StoryStreamlitGeneration.AppendNumericCoerce(
            sb,
            indentation,
            varName,
            ["impact_score", "progress_pct", "risk_score", "investment", "benefit_value"]);
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.dropna(subset=['item_name'])");
        AppendRecordLoop(sb, indentation, varName);
        AppendSummaryAndPayload(sb, indentation, varName, props);
    }

    private static void AppendRecordLoop(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_records = []");
        sb.AppendLine($"{indentation}    {varName}_has_progress = 'progress_pct' in {varName}_df.columns");
        sb.AppendLine($"{indentation}    {varName}_has_due = 'due_date' in {varName}_df.columns");
        sb.AppendLine($"{indentation}    {varName}_has_status = 'status' in {varName}_df.columns");
        sb.AppendLine($"{indentation}    {varName}_can_health = {varName}_has_progress and {varName}_has_due and {varName}_has_status");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        _name = '' if pd.isna(_row.get('item_name')) else str(_row.get('item_name')).strip()");
        sb.AppendLine($"{indentation}        if not _name:");
        sb.AppendLine($"{indentation}            continue");
        sb.AppendLine($"{indentation}        _rec = {{");
        sb.AppendLine($"{indentation}            'item_name': _name,");
        sb.AppendLine($"{indentation}            'impact_score': float(_row.get('impact_score') or 0),");
        sb.AppendLine($"{indentation}            'priority_level': '' if pd.isna(_row.get('priority_level', '')) else str(_row.get('priority_level', '')).strip(),");
        sb.AppendLine($"{indentation}            'progress_pct': float(_row.get('progress_pct') or 0),");
        sb.AppendLine($"{indentation}            'category': '' if pd.isna(_row.get('category', '')) else str(_row.get('category', '')).strip(),");
        sb.AppendLine($"{indentation}        }}");
        sb.AppendLine($"{indentation}        if 'trend' in {varName}_df.columns and not pd.isna(_row.get('trend')) and str(_row.get('trend')).strip():");
        sb.AppendLine($"{indentation}            _rec['trend'] = str(_row.get('trend')).strip().lower()");
        sb.AppendLine($"{indentation}        if 'risk_score' in {varName}_df.columns and not pd.isna(_row.get('risk_score')):");
        sb.AppendLine($"{indentation}            _rec['risk_score'] = float(_row.get('risk_score'))");
        sb.AppendLine($"{indentation}        if 'owner' in {varName}_df.columns and not pd.isna(_row.get('owner')) and str(_row.get('owner')).strip():");
        sb.AppendLine($"{indentation}            _rec['owner'] = str(_row.get('owner')).strip()");
        sb.AppendLine($"{indentation}        if 'due_date' in {varName}_df.columns and not pd.isna(_row.get('due_date')):");
        sb.AppendLine($"{indentation}            _rec['due_date'] = str(_row.get('due_date'))");
        sb.AppendLine($"{indentation}        if 'investment' in {varName}_df.columns and not pd.isna(_row.get('investment')):");
        sb.AppendLine($"{indentation}            _rec['investment'] = float(_row.get('investment'))");
        sb.AppendLine($"{indentation}        if 'benefit_value' in {varName}_df.columns and not pd.isna(_row.get('benefit_value')):");
        sb.AppendLine($"{indentation}            _rec['benefit_value'] = float(_row.get('benefit_value'))");
        sb.AppendLine($"{indentation}        if 'notes' in {varName}_df.columns and not pd.isna(_row.get('notes')) and str(_row.get('notes')).strip():");
        sb.AppendLine($"{indentation}            _rec['notes'] = str(_row.get('notes')).strip()");
        sb.AppendLine($"{indentation}        if 'status' in {varName}_df.columns and not pd.isna(_row.get('status')) and str(_row.get('status')).strip():");
        sb.AppendLine($"{indentation}            _rec['status'] = str(_row.get('status')).strip()");
        AppendDeliveryHealth(sb, indentation, varName);
        sb.AppendLine($"{indentation}        {varName}_records.append(_rec)");
    }

    private static void AppendDeliveryHealth(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}        if {varName}_can_health:");
        sb.AppendLine($"{indentation}            _status = str(_rec.get('status', '')).strip().lower()");
        sb.AppendLine($"{indentation}            _prog = float(_rec.get('progress_pct') or 0)");
        sb.AppendLine($"{indentation}            _due = _rec.get('due_date')");
        sb.AppendLine($"{indentation}            _overdue = False");
        sb.AppendLine($"{indentation}            try:");
        sb.AppendLine($"{indentation}                _due_ts = pd.to_datetime(_due, errors='coerce')");
        sb.AppendLine($"{indentation}                if pd.notna(_due_ts) and _due_ts < pd.Timestamp.utcnow().normalize() and _prog < 100:");
        sb.AppendLine($"{indentation}                    _overdue = True");
        sb.AppendLine($"{indentation}            except Exception:");
        sb.AppendLine($"{indentation}                pass");
        sb.AppendLine($"{indentation}            if _status in ('critical', 'blocked', 'failed') or (_overdue and _prog < 50):");
        sb.AppendLine($"{indentation}                _rec['delivery_health'] = 'behind'");
        sb.AppendLine($"{indentation}            elif _status in ('at risk', 'at_risk', 'watch', 'delayed') or _overdue:");
        sb.AppendLine($"{indentation}                _rec['delivery_health'] = 'at_risk'");
        sb.AppendLine($"{indentation}            else:");
        sb.AppendLine($"{indentation}                _rec['delivery_health'] = 'on_track'");
    }

    private static void AppendSummaryAndPayload(
        StringBuilder sb,
        string indentation,
        string varName,
        HoneycombStoryProps props)
    {
        sb.AppendLine($"{indentation}    {varName}_cats = set(r.get('category') or '' for r in {varName}_records)");
        sb.AppendLine($"{indentation}    {varName}_cats.discard('')");
        sb.AppendLine($"{indentation}    {varName}_avg_prog = (sum(r.get('progress_pct', 0) for r in {varName}_records) / len({varName}_records)) if {varName}_records else 0");
        sb.AppendLine($"{indentation}    {varName}_hilp = [r for r in {varName}_records if r.get('impact_score', 0) >= 70 and r.get('progress_pct', 0) < 40]");
        sb.AppendLine($"{indentation}    {varName}_with_risk = [r for r in {varName}_records if 'risk_score' in r]");
        sb.AppendLine($"{indentation}    {varName}_highest_risk = max({varName}_with_risk, key=lambda r: r.get('risk_score', 0), default=None) if {varName}_with_risk else None");
        sb.AppendLine($"{indentation}    {varName}_health_counts = None");
        sb.AppendLine($"{indentation}    if any('delivery_health' in r for r in {varName}_records):");
        sb.AppendLine($"{indentation}        {varName}_health_counts = {{'on_track': 0, 'at_risk': 0, 'behind': 0}}");
        sb.AppendLine($"{indentation}        for _r in {varName}_records:");
        sb.AppendLine($"{indentation}            _h = _r.get('delivery_health')");
        sb.AppendLine($"{indentation}            if _h in {varName}_health_counts:");
        sb.AppendLine($"{indentation}                {varName}_health_counts[_h] += 1");
        sb.AppendLine($"{indentation}    {varName}_warnings = []");
        sb.AppendLine($"{indentation}    if len({varName}_records) < 3:");
        sb.AppendLine($"{indentation}        {varName}_warnings.append('Fewer than 3 items — honeycomb story may be less meaningful.')");
        sb.AppendLine($"{indentation}    {varName}_payload = {{");
        sb.AppendLine($"{indentation}        'records': {varName}_records,");
        sb.AppendLine($"{indentation}        'visualConfig': {{");
        sb.AppendLine($"{indentation}            'show_labels': {ToPythonBool(props.ShowLabels)},");
        sb.AppendLine($"{indentation}            'show_risk_borders': {ToPythonBool(props.ShowRiskBorders)},");
        sb.AppendLine($"{indentation}            'show_trend_arrows': {ToPythonBool(props.ShowTrendArrows)},");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'summary': {{");
        sb.AppendLine($"{indentation}            'item_count': len({varName}_records),");
        sb.AppendLine($"{indentation}            'category_count': len({varName}_cats),");
        sb.AppendLine($"{indentation}            'avg_progress': {varName}_avg_prog,");
        sb.AppendLine($"{indentation}            'high_impact_low_progress': [{{'item_name': r['item_name'], 'impact_score': r['impact_score'], 'progress_pct': r['progress_pct']}} for r in {varName}_hilp],");
        sb.AppendLine($"{indentation}            'highest_risk': ({{'item_name': {varName}_highest_risk['item_name'], 'risk_score': {varName}_highest_risk['risk_score']}} if {varName}_highest_risk else None),");
        sb.AppendLine($"{indentation}            'delivery_health': {varName}_health_counts,");
        sb.AppendLine($"{indentation}            'warnings': {varName}_warnings,");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}    }}");
        StoryStreamlitGeneration.AppendComponentsHtml(
            sb,
            indentation,
            varName,
            HoneycombStreamlitHtmlHelper.GetHtmlTemplatePythonLiteral(),
            HoneycombStreamlitHtmlHelper.PayloadPlaceholder,
            HoneycombStreamlitHtmlHelper.DefaultHeightPx);
    }
}
