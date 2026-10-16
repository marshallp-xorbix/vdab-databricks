using System.Globalization;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

/// <summary>
/// Service for Network Web Story visualization component.
/// </summary>
public class NetworkWebStoryComponentService : BaseComponentService, INetworkWebStoryComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.NetworkWebStory;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new NetworkWebStoryComponentDto
        {
            Id = "template-networkwebstory",
            CodeName = "templateNetworkWebStory",
            Type = ComponentType.NetworkWebStory,
            Category = ComponentCategory.Visualization,
            Icon = "NetworkWebStory",
            SchemaVersion = 1,
            Props = StoryComponentDefaults.CreateNetworkWebProps("Network Web Story"),
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
        NetworkWebStoryComponentDto network = (NetworkWebStoryComponentDto)component;
        string varName = GetVariableName(component);

        if (!StoryStreamlitGeneration.TryAppendQueryAndFetch(
                sb,
                indentation,
                component,
                varName,
                network.Props.Title ?? "Network Web Story",
                "Bind a table and map source, target, relationship type, and weight fields to render this visualization.",
                bindingContext => NetworkWebQueryBuilder.BuildSql(bindingContext, network.Props),
                "Fetch data for Network Web Story"))
        {
            return sb.ToString().TrimEnd();
        }

        AppendPayloadAndHtml(sb, indentation, varName, network.Props);
        return sb.ToString().TrimEnd();
    }

    private static void AppendPayloadAndHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        NetworkWebStoryProps props)
    {
        int maxNodes = Math.Clamp(props.MaxNodes, 10, 500);
        int maxEdges = Math.Clamp(props.MaxEdges, 10, 2000);
        double minWeight = Math.Max(0, props.MinWeightFilter);
        int highlightDepth = Math.Clamp(props.HighlightDepth, 1, 3);

        sb.AppendLine($"{indentation}if {varName}_data is None or {varName}_data.empty or 'source_entity_id' not in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    st.info('No network edges returned. Check bindings and field mappings.')");
        sb.AppendLine($"{indentation}else:");
        StoryStreamlitGeneration.AppendNumericCoerce(
            sb,
            indentation,
            varName,
            [
                "relationship_weight",
                "edge_value",
                "frequency",
                "edge_risk_score",
                "source_value",
                "target_value",
                "source_health_score",
                "target_health_score",
                "source_risk_score",
                "target_risk_score",
            ]);
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.dropna(subset=['source_entity_id', 'target_entity_id'])");
        sb.AppendLine($"{indentation}    {varName}_df['relationship_weight'] = {varName}_df['relationship_weight'].fillna(0)");
        sb.AppendLine($"{indentation}    {varName}_min_w = {minWeight.ToString(CultureInfo.InvariantCulture)}");
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df[{varName}_df['relationship_weight'] >= {varName}_min_w]");
        AppendEdgeAggregation(sb, indentation, varName);
        AppendNodeMetadata(sb, indentation, varName);
        AppendNodeEdgeCapping(sb, indentation, varName, maxNodes, maxEdges);
        AppendPayload(sb, indentation, varName, props, maxNodes, maxEdges, minWeight, highlightDepth);
    }

    private static void AppendEdgeAggregation(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_edge_map = {{}}");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        _sid = str(_row.get('source_entity_id'))");
        sb.AppendLine($"{indentation}        _tid = str(_row.get('target_entity_id'))");
        sb.AppendLine($"{indentation}        _rtype = '' if pd.isna(_row.get('relationship_type', '')) else str(_row.get('relationship_type', ''))");
        sb.AppendLine($"{indentation}        _key = (_sid, _tid, _rtype)");
        sb.AppendLine($"{indentation}        _w = float(_row.get('relationship_weight') or 0)");
        sb.AppendLine($"{indentation}        if _key in {varName}_edge_map:");
        sb.AppendLine($"{indentation}            {varName}_edge_map[_key]['weight'] += _w");
        sb.AppendLine($"{indentation}            _ev = _row.get('edge_value')");
        sb.AppendLine($"{indentation}            if 'edge_value' in {varName}_df.columns and not pd.isna(_ev):");
        sb.AppendLine($"{indentation}                {varName}_edge_map[_key]['edge_value'] = ({varName}_edge_map[_key].get('edge_value') or 0) + float(_ev)");
        sb.AppendLine($"{indentation}            _fq = _row.get('frequency')");
        sb.AppendLine($"{indentation}            if 'frequency' in {varName}_df.columns and not pd.isna(_fq):");
        sb.AppendLine($"{indentation}                {varName}_edge_map[_key]['frequency'] = ({varName}_edge_map[_key].get('frequency') or 0) + float(_fq)");
        sb.AppendLine($"{indentation}            continue");
        sb.AppendLine($"{indentation}        _edge = {{");
        sb.AppendLine($"{indentation}            'source': _sid,");
        sb.AppendLine($"{indentation}            'target': _tid,");
        sb.AppendLine($"{indentation}            'relationship_type': _rtype,");
        sb.AppendLine($"{indentation}            'weight': _w,");
        sb.AppendLine($"{indentation}        }}");
        sb.AppendLine($"{indentation}        if 'direction' in {varName}_df.columns and not pd.isna(_row.get('direction')):");
        sb.AppendLine($"{indentation}            _edge['direction'] = str(_row.get('direction'))");
        sb.AppendLine($"{indentation}        if 'edge_value' in {varName}_df.columns and not pd.isna(_row.get('edge_value')):");
        sb.AppendLine($"{indentation}            _edge['edge_value'] = float(_row.get('edge_value'))");
        sb.AppendLine($"{indentation}        if 'frequency' in {varName}_df.columns and not pd.isna(_row.get('frequency')):");
        sb.AppendLine($"{indentation}            _edge['frequency'] = float(_row.get('frequency'))");
        sb.AppendLine($"{indentation}        if 'edge_risk_score' in {varName}_df.columns and not pd.isna(_row.get('edge_risk_score')):");
        sb.AppendLine($"{indentation}            _edge['edge_risk_score'] = float(_row.get('edge_risk_score'))");
        sb.AppendLine($"{indentation}        if 'edge_status' in {varName}_df.columns and not pd.isna(_row.get('edge_status')):");
        sb.AppendLine($"{indentation}            _edge['edge_status'] = str(_row.get('edge_status'))");
        sb.AppendLine($"{indentation}        {varName}_edge_map[_key] = _edge");
        sb.AppendLine($"{indentation}    {varName}_edges = list({varName}_edge_map.values())");
        sb.AppendLine($"{indentation}    {varName}_edges.sort(key=lambda e: e.get('weight', 0), reverse=True)");
    }

    private static void AppendNodeMetadata(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_node_meta = {{}}");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        for _prefix, _id_col, _label_col in [('source', 'source_entity_id', 'source_entity_label'), ('target', 'target_entity_id', 'target_entity_label')]:");
        sb.AppendLine($"{indentation}            _nid = str(_row.get(_id_col))");
        sb.AppendLine($"{indentation}            if _nid not in {varName}_node_meta:");
        sb.AppendLine($"{indentation}                {varName}_node_meta[_nid] = {{'id': _nid, 'label': '' if pd.isna(_row.get(_label_col, '')) else str(_row.get(_label_col, '')), 'category': '', 'value': None, 'health_score': None, 'risk_score': None}}");
        sb.AppendLine($"{indentation}            _meta = {varName}_node_meta[_nid]");
        sb.AppendLine($"{indentation}            if not _meta['label'] and not pd.isna(_row.get(_label_col, '')):");
        sb.AppendLine($"{indentation}                _meta['label'] = str(_row.get(_label_col))");
        sb.AppendLine($"{indentation}            _cat_col = f'{{_prefix}}_category'");
        sb.AppendLine($"{indentation}            if _cat_col in {varName}_df.columns and not pd.isna(_row.get(_cat_col)) and not _meta['category']:");
        sb.AppendLine($"{indentation}                _meta['category'] = str(_row.get(_cat_col))");
        sb.AppendLine($"{indentation}            for _attr, _suffix in [('value', 'value'), ('health_score', 'health_score'), ('risk_score', 'risk_score')]:");
        sb.AppendLine($"{indentation}                _acol = f'{{_prefix}}_{{_suffix}}'");
        sb.AppendLine($"{indentation}                if _acol in {varName}_df.columns and not pd.isna(_row.get(_acol)) and _meta[_attr] is None:");
        sb.AppendLine($"{indentation}                    _meta[_attr] = float(_row.get(_acol))");
    }

    private static void AppendNodeEdgeCapping(
        StringBuilder sb,
        string indentation,
        string varName,
        int maxNodes,
        int maxEdges)
    {
        sb.AppendLine($"{indentation}    {varName}_degree = {{}}");
        sb.AppendLine($"{indentation}    for _e in {varName}_edges:");
        sb.AppendLine($"{indentation}        {varName}_degree[_e['source']] = {varName}_degree.get(_e['source'], 0) + 1");
        sb.AppendLine($"{indentation}        {varName}_degree[_e['target']] = {varName}_degree.get(_e['target'], 0) + 1");
        sb.AppendLine($"{indentation}    {varName}_node_ids = sorted({varName}_node_meta.keys(), key=lambda n: {varName}_degree.get(n, 0), reverse=True)");
        sb.AppendLine($"{indentation}    {varName}_max_nodes = {maxNodes}");
        sb.AppendLine($"{indentation}    {varName}_max_edges = {maxEdges}");
        sb.AppendLine($"{indentation}    {varName}_keep_nodes = set({varName}_node_ids[:{varName}_max_nodes])");
        sb.AppendLine($"{indentation}    {varName}_edges = [e for e in {varName}_edges if e['source'] in {varName}_keep_nodes and e['target'] in {varName}_keep_nodes][:{varName}_max_edges]");
        sb.AppendLine($"{indentation}    {varName}_keep_nodes = set()");
        sb.AppendLine($"{indentation}    for _e in {varName}_edges:");
        sb.AppendLine($"{indentation}        {varName}_keep_nodes.add(_e['source'])");
        sb.AppendLine($"{indentation}        {varName}_keep_nodes.add(_e['target'])");
        sb.AppendLine($"{indentation}    {varName}_nodes = []");
        sb.AppendLine($"{indentation}    for _nid in {varName}_keep_nodes:");
        sb.AppendLine($"{indentation}        _m = {varName}_node_meta[_nid]");
        sb.AppendLine($"{indentation}        _node = {{'id': _nid, 'label': _m['label'] or _nid, 'category': _m['category'] or 'Other', 'degree': int({varName}_degree.get(_nid, 0))}}");
        sb.AppendLine($"{indentation}        if _m['value'] is not None: _node['value'] = _m['value']");
        sb.AppendLine($"{indentation}        if _m['health_score'] is not None: _node['health_score'] = _m['health_score']");
        sb.AppendLine($"{indentation}        if _m['risk_score'] is not None: _node['risk_score'] = _m['risk_score']");
        sb.AppendLine($"{indentation}        {varName}_nodes.append(_node)");
    }

    private static void AppendPayload(
        StringBuilder sb,
        string indentation,
        string varName,
        NetworkWebStoryProps props,
        int maxNodes,
        int maxEdges,
        double minWeight,
        int highlightDepth)
    {
        sb.AppendLine($"{indentation}    {varName}_payload = {{");
        sb.AppendLine($"{indentation}        'nodes': {varName}_nodes,");
        sb.AppendLine($"{indentation}        'edges': {varName}_edges,");
        sb.AppendLine($"{indentation}        'visualConfig': {{");
        sb.AppendLine($"{indentation}            'layout_algorithm': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.LayoutAlgorithm, "force", "force", "radial"))}',");
        sb.AppendLine($"{indentation}            'node_size_by': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.NodeSizeBy, "degree", "degree", "value", "none"))}',");
        sb.AppendLine($"{indentation}            'node_color_by': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.NodeColorBy, "category", "category", "health_score", "risk_score"))}',");
        sb.AppendLine($"{indentation}            'edge_width_by': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.EdgeWidthBy, "weight", "weight", "value", "frequency", "none"))}',");
        sb.AppendLine($"{indentation}            'edge_color_by': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.EdgeColorBy, "relationship_type", "relationship_type", "risk_score", "status", "none"))}',");
        sb.AppendLine($"{indentation}            'show_arrows': {ToPythonBool(props.ShowArrows)},");
        sb.AppendLine($"{indentation}            'highlight_depth': {highlightDepth},");
        sb.AppendLine($"{indentation}            'min_weight_filter': {minWeight.ToString(CultureInfo.InvariantCulture)},");
        sb.AppendLine($"{indentation}            'max_nodes': {maxNodes},");
        sb.AppendLine($"{indentation}            'max_edges': {maxEdges},");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'summary': {{");
        sb.AppendLine($"{indentation}            'total_nodes': len({varName}_nodes),");
        sb.AppendLine($"{indentation}            'total_edges': len({varName}_edges),");
        sb.AppendLine($"{indentation}            'warnings': [],");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}    }}");
        StoryStreamlitGeneration.AppendComponentsHtml(
            sb,
            indentation,
            varName,
            NetworkWebStreamlitHtmlHelper.GetHtmlTemplatePythonLiteral(),
            NetworkWebStreamlitHtmlHelper.PayloadPlaceholder,
            NetworkWebStreamlitHtmlHelper.DefaultHeightPx);
    }
}
