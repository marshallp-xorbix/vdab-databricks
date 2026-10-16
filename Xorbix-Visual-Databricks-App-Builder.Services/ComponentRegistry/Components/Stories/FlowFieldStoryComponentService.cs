using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

/// <summary>
/// Service for Flow Field Story visualization component.
/// </summary>
public class FlowFieldStoryComponentService : BaseComponentService, IFlowFieldStoryComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.FlowFieldStory;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new FlowFieldStoryComponentDto
        {
            Id = "template-flowfieldstory",
            CodeName = "templateFlowFieldStory",
            Type = ComponentType.FlowFieldStory,
            Category = ComponentCategory.Visualization,
            Icon = "FlowFieldStory",
            SchemaVersion = 1,
            Props = StoryComponentDefaults.CreateFlowFieldProps("Flow Field Story"),
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
        FlowFieldStoryComponentDto flowField = (FlowFieldStoryComponentDto)component;
        string varName = GetVariableName(component);

        if (!StoryStreamlitGeneration.TryAppendQueryAndFetch(
                sb,
                indentation,
                component,
                varName,
                flowField.Props.Title ?? "Flow Field Story",
                "Bind a table and map source, destination, volume, and stage order fields to render this visualization.",
                bindingContext => FlowFieldQueryBuilder.BuildSql(bindingContext, flowField.Props),
                "Fetch data for Flow Field Story"))
        {
            return sb.ToString().TrimEnd();
        }

        AppendPayloadAndHtml(sb, indentation, varName, flowField.Props);
        return sb.ToString().TrimEnd();
    }

    private static void AppendPayloadAndHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        FlowFieldStoryProps props)
    {
        sb.AppendLine($"{indentation}if {varName}_data is None or {varName}_data.empty or 'source_stage' not in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    st.info('No flow records returned. Check bindings and field mappings.')");
        sb.AppendLine($"{indentation}else:");
        StoryStreamlitGeneration.AppendNumericCoerce(
            sb,
            indentation,
            varName,
            ["flow_volume", "stage_order", "conversion_pct", "drop_off", "avg_time_in_stage"]);
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.dropna(subset=['source_stage', 'destination_stage'])");
        sb.AppendLine($"{indentation}    {varName}_df['flow_volume'] = {varName}_df['flow_volume'].fillna(0)");
        sb.AppendLine($"{indentation}    {varName}_df['stage_order'] = {varName}_df['stage_order'].fillna(0)");
        AppendFlowLoop(sb, indentation, varName);
        AppendStages(sb, indentation, varName);
        AppendSummaryAndPayload(sb, indentation, varName, props);
    }

    private static void AppendFlowLoop(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_flows = []");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        _src = '' if pd.isna(_row.get('source_stage')) else str(_row.get('source_stage')).strip()");
        sb.AppendLine($"{indentation}        _dst = '' if pd.isna(_row.get('destination_stage')) else str(_row.get('destination_stage')).strip()");
        sb.AppendLine($"{indentation}        if not _src or not _dst:");
        sb.AppendLine($"{indentation}            continue");
        sb.AppendLine($"{indentation}        _flow = {{");
        sb.AppendLine($"{indentation}            'source': _src,");
        sb.AppendLine($"{indentation}            'destination': _dst,");
        sb.AppendLine($"{indentation}            'volume': float(_row.get('flow_volume') or 0),");
        sb.AppendLine($"{indentation}            'stage_order': float(_row.get('stage_order') or 0),");
        sb.AppendLine($"{indentation}        }}");
        sb.AppendLine($"{indentation}        if 'conversion_pct' in {varName}_df.columns and not pd.isna(_row.get('conversion_pct')):");
        sb.AppendLine($"{indentation}            _flow['conversion_pct'] = float(_row.get('conversion_pct'))");
        sb.AppendLine($"{indentation}        if 'drop_off' in {varName}_df.columns and not pd.isna(_row.get('drop_off')):");
        sb.AppendLine($"{indentation}            _flow['drop_off'] = float(_row.get('drop_off'))");
        sb.AppendLine($"{indentation}        if 'avg_time_in_stage' in {varName}_df.columns and not pd.isna(_row.get('avg_time_in_stage')):");
        sb.AppendLine($"{indentation}            _flow['avg_time_in_stage'] = float(_row.get('avg_time_in_stage'))");
        sb.AppendLine($"{indentation}        if 'status' in {varName}_df.columns and not pd.isna(_row.get('status')) and str(_row.get('status')).strip():");
        sb.AppendLine($"{indentation}            _flow['status'] = str(_row.get('status')).strip().lower()");
        sb.AppendLine($"{indentation}        {varName}_flows.append(_flow)");
    }

    private static void AppendStages(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_order_by_stage = {{}}");
        sb.AppendLine($"{indentation}    for _f in {varName}_flows:");
        sb.AppendLine($"{indentation}        _name = _f['source']");
        sb.AppendLine($"{indentation}        _ord = _f.get('stage_order', 0)");
        sb.AppendLine($"{indentation}        if _name not in {varName}_order_by_stage or _ord > {varName}_order_by_stage[_name]:");
        sb.AppendLine($"{indentation}            {varName}_order_by_stage[_name] = _ord");
        sb.AppendLine($"{indentation}    {varName}_all_names = set({varName}_order_by_stage.keys())");
        sb.AppendLine($"{indentation}    for _f in {varName}_flows:");
        sb.AppendLine($"{indentation}        {varName}_all_names.add(_f['destination'])");
        sb.AppendLine($"{indentation}    {varName}_max_ord = max({varName}_order_by_stage.values()) if {varName}_order_by_stage else 0");
        sb.AppendLine($"{indentation}    {varName}_stages = []");
        sb.AppendLine($"{indentation}    for _name in {varName}_all_names:");
        sb.AppendLine($"{indentation}        _ord = {varName}_order_by_stage.get(_name)");
        sb.AppendLine($"{indentation}        if _ord is None:");
        sb.AppendLine($"{indentation}            _ord = {varName}_max_ord + 1");
        sb.AppendLine($"{indentation}        {varName}_stages.append({{'name': _name, 'order': float(_ord)}})");
        sb.AppendLine($"{indentation}    {varName}_stages = sorted({varName}_stages, key=lambda s: (s['order'], s['name']))");
    }

    private static void AppendSummaryAndPayload(
        StringBuilder sb,
        string indentation,
        string varName,
        FlowFieldStoryProps props)
    {
        sb.AppendLine($"{indentation}    {varName}_with_drop = [f for f in {varName}_flows if 'drop_off' in f]");
        sb.AppendLine($"{indentation}    {varName}_largest_drop = max({varName}_with_drop, key=lambda f: f.get('drop_off', 0), default=None) if {varName}_with_drop else None");
        sb.AppendLine($"{indentation}    {varName}_bottleneck = None");
        sb.AppendLine($"{indentation}    {varName}_with_conv = [f for f in {varName}_flows if 'conversion_pct' in f]");
        sb.AppendLine($"{indentation}    if {varName}_with_conv:");
        sb.AppendLine($"{indentation}        {varName}_worst = min({varName}_with_conv, key=lambda f: f.get('conversion_pct', 100))");
        sb.AppendLine($"{indentation}        {varName}_bottleneck = {{'name': {varName}_worst['source'], 'reason': 'low_conversion'}}");
        sb.AppendLine($"{indentation}    elif {varName}_flows:");
        sb.AppendLine($"{indentation}        {varName}_heaviest = max({varName}_flows, key=lambda f: f.get('volume', 0))");
        sb.AppendLine($"{indentation}        {varName}_bottleneck = {{'name': {varName}_heaviest['source'], 'reason': 'high_volume'}}");
        sb.AppendLine($"{indentation}    {varName}_warnings = []");
        sb.AppendLine($"{indentation}    if len({varName}_flows) < 2:");
        sb.AppendLine($"{indentation}        {varName}_warnings.append('Fewer than 2 flows — story may be less meaningful.')");
        sb.AppendLine($"{indentation}    {varName}_payload = {{");
        sb.AppendLine($"{indentation}        'stages': {varName}_stages,");
        sb.AppendLine($"{indentation}        'flows': {varName}_flows,");
        sb.AppendLine($"{indentation}        'visualConfig': {{");
        sb.AppendLine($"{indentation}            'show_drop_offs': {ToPythonBool(props.ShowDropOffs)},");
        sb.AppendLine($"{indentation}            'show_labels': {ToPythonBool(props.ShowLabels)},");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'summary': {{");
        sb.AppendLine($"{indentation}            'stage_count': len({varName}_stages),");
        sb.AppendLine($"{indentation}            'flow_count': len({varName}_flows),");
        sb.AppendLine($"{indentation}            'total_volume': sum(f.get('volume', 0) for f in {varName}_flows),");
        sb.AppendLine($"{indentation}            'largest_drop_off': ({{'source': {varName}_largest_drop['source'], 'destination': {varName}_largest_drop['destination'], 'drop_off': {varName}_largest_drop['drop_off']}} if {varName}_largest_drop else None),");
        sb.AppendLine($"{indentation}            'bottleneck_stage': {varName}_bottleneck,");
        sb.AppendLine($"{indentation}            'warnings': {varName}_warnings,");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}    }}");
        StoryStreamlitGeneration.AppendComponentsHtml(
            sb,
            indentation,
            varName,
            FlowFieldStreamlitHtmlHelper.GetHtmlTemplatePythonLiteral(),
            FlowFieldStreamlitHtmlHelper.PayloadPlaceholder,
            FlowFieldStreamlitHtmlHelper.DefaultHeightPx);
    }
}
