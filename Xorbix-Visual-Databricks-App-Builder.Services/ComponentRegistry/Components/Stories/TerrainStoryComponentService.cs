using System.Globalization;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

/// <summary>
/// Service for Terrain Story visualization component.
/// </summary>
public class TerrainStoryComponentService : BaseComponentService, ITerrainStoryComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.TerrainStory;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new TerrainStoryComponentDto
        {
            Id = "template-terrainstory",
            CodeName = "templateTerrainStory",
            Type = ComponentType.TerrainStory,
            Category = ComponentCategory.Visualization,
            Icon = "TerrainStory",
            SchemaVersion = 1,
            Props = StoryComponentDefaults.CreateTerrainProps("Terrain Story"),
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
        TerrainStoryComponentDto terrain = (TerrainStoryComponentDto)component;
        string varName = GetVariableName(component);

        if (!StoryStreamlitGeneration.TryAppendQueryAndFetch(
                sb,
                indentation,
                component,
                varName,
                terrain.Props.Title ?? "Terrain Story",
                "Bind a table and map X, Y, and height fields to render this visualization.",
                bindingContext => TerrainQueryBuilder.BuildSql(bindingContext, terrain.Props),
                "Fetch data for Terrain Story"))
        {
            return sb.ToString().TrimEnd();
        }

        AppendPayloadAndHtml(sb, indentation, varName, terrain.Props);
        return sb.ToString().TrimEnd();
    }

    private static void AppendPayloadAndHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        TerrainStoryProps props)
    {
        sb.AppendLine($"{indentation}if {varName}_data is None or {varName}_data.empty or 'x_value' not in {varName}_data.columns or 'y_value' not in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    st.info('No terrain cells returned. Check bindings and field mappings.')");
        sb.AppendLine($"{indentation}else:");
        StoryStreamlitGeneration.AppendNumericCoerce(
            sb,
            indentation,
            varName,
            ["height_value", "risk_score", "target_value", "baseline_value", "forecast_value", "volume_value"]);
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.dropna(subset=['x_value', 'y_value'])");
        sb.AppendLine($"{indentation}    {varName}_df['height_value'] = {varName}_df['height_value'].fillna(0)");
        AppendRecordAndCalloutLoop(sb, indentation, varName);
        AppendSummaryAndPayload(sb, indentation, varName, props);
    }

    private static void AppendRecordAndCalloutLoop(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_records = []");
        sb.AppendLine($"{indentation}    {varName}_callouts = []");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        _rec = {{");
        sb.AppendLine($"{indentation}            'x': '' if pd.isna(_row.get('x_value')) else str(_row.get('x_value')),");
        sb.AppendLine($"{indentation}            'y': '' if pd.isna(_row.get('y_value')) else str(_row.get('y_value')),");
        sb.AppendLine($"{indentation}            'height': float(_row.get('height_value') or 0),");
        sb.AppendLine($"{indentation}        }}");
        sb.AppendLine($"{indentation}        if 'category' in {varName}_df.columns and not pd.isna(_row.get('category')):");
        sb.AppendLine($"{indentation}            _rec['category'] = str(_row.get('category'))");
        sb.AppendLine($"{indentation}        if 'risk_score' in {varName}_df.columns and not pd.isna(_row.get('risk_score')):");
        sb.AppendLine($"{indentation}            _rec['risk_score'] = float(_row.get('risk_score'))");
        sb.AppendLine($"{indentation}        if 'target_value' in {varName}_df.columns and not pd.isna(_row.get('target_value')):");
        sb.AppendLine($"{indentation}            _rec['target_value'] = float(_row.get('target_value'))");
        sb.AppendLine($"{indentation}        if 'baseline_value' in {varName}_df.columns and not pd.isna(_row.get('baseline_value')):");
        sb.AppendLine($"{indentation}            _rec['baseline_value'] = float(_row.get('baseline_value'))");
        sb.AppendLine($"{indentation}        if 'forecast_value' in {varName}_df.columns and not pd.isna(_row.get('forecast_value')):");
        sb.AppendLine($"{indentation}            _rec['forecast_value'] = float(_row.get('forecast_value'))");
        sb.AppendLine($"{indentation}        if 'volume_value' in {varName}_df.columns and not pd.isna(_row.get('volume_value')):");
        sb.AppendLine($"{indentation}            _rec['volume_value'] = float(_row.get('volume_value'))");
        sb.AppendLine($"{indentation}        if 'status' in {varName}_df.columns and not pd.isna(_row.get('status')):");
        sb.AppendLine($"{indentation}            _rec['status'] = str(_row.get('status'))");
        sb.AppendLine($"{indentation}        if 'target_value' in _rec and 'baseline_value' in _rec:");
        sb.AppendLine($"{indentation}            _rec['variance'] = _rec['height'] - _rec.get('baseline_value', _rec.get('target_value', 0))");
        sb.AppendLine($"{indentation}        elif 'target_value' in _rec:");
        sb.AppendLine($"{indentation}            _rec['variance'] = _rec['height'] - _rec['target_value']");
        sb.AppendLine($"{indentation}        {varName}_records.append(_rec)");
        sb.AppendLine($"{indentation}        _ename = None");
        sb.AppendLine($"{indentation}        if 'event_name' in {varName}_df.columns and not pd.isna(_row.get('event_name')) and str(_row.get('event_name')).strip():");
        sb.AppendLine($"{indentation}            _ename = str(_row.get('event_name')).strip()");
        sb.AppendLine($"{indentation}        _ctext = None");
        sb.AppendLine($"{indentation}        if 'callout_text' in {varName}_df.columns and not pd.isna(_row.get('callout_text')) and str(_row.get('callout_text')).strip():");
        sb.AppendLine($"{indentation}            _ctext = str(_row.get('callout_text')).strip()");
        sb.AppendLine($"{indentation}        if _ename or _ctext:");
        sb.AppendLine($"{indentation}            _call = {{'x': _rec['x'], 'y': _rec['y'], 'label': _ename or 'Callout', 'metric_value': _rec['height']}}");
        sb.AppendLine($"{indentation}            if 'event_date' in {varName}_df.columns and not pd.isna(_row.get('event_date')):");
        sb.AppendLine($"{indentation}                _call['event_date'] = str(_row.get('event_date'))");
        sb.AppendLine($"{indentation}            if _ctext:");
        sb.AppendLine($"{indentation}                _call['description'] = _ctext");
        sb.AppendLine($"{indentation}            if 'status' in _rec:");
        sb.AppendLine($"{indentation}                _call['severity'] = _rec['status']");
        sb.AppendLine($"{indentation}            {varName}_callouts.append(_call)");
    }

    private static void AppendSummaryAndPayload(
        StringBuilder sb,
        string indentation,
        string varName,
        TerrainStoryProps props)
    {
        sb.AppendLine($"{indentation}    {varName}_sorted = sorted({varName}_records, key=lambda r: r.get('height', 0), reverse=True)");
        sb.AppendLine($"{indentation}    {varName}_peaks = [{{'x': r['x'], 'y': r['y'], 'height': r['height']}} for r in {varName}_sorted[:3]]");
        sb.AppendLine($"{indentation}    {varName}_valleys = [{{'x': r['x'], 'y': r['y'], 'height': r['height']}} for r in sorted({varName}_records, key=lambda r: r.get('height', 0))[:3]]");
        sb.AppendLine($"{indentation}    {varName}_payload = {{");
        sb.AppendLine($"{indentation}        'records': {varName}_records,");
        sb.AppendLine($"{indentation}        'callouts': {varName}_callouts,");
        sb.AppendLine($"{indentation}        'visualConfig': {{");
        sb.AppendLine($"{indentation}            'terrain_mode': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.TerrainMode, "surface", "surface", "heat_surface", "ridge"))}',");
        sb.AppendLine($"{indentation}            'height_scale': {Math.Clamp(props.HeightScale, 0.1, 5).ToString(CultureInfo.InvariantCulture)},");
        sb.AppendLine($"{indentation}            'interpolation': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.Interpolation, "bilinear", "none", "bilinear"))}',");
        sb.AppendLine($"{indentation}            'grid_resolution': {Math.Clamp(props.GridResolution, 10, 120)},");
        sb.AppendLine($"{indentation}            'color_by': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.ColorBy, "height_metric", "height_metric", "risk_score", "variance", "category"))}',");
        sb.AppendLine($"{indentation}            'show_peak_labels': {ToPythonBool(props.ShowPeakLabels)},");
        sb.AppendLine($"{indentation}            'show_valley_labels': {ToPythonBool(props.ShowValleyLabels)},");
        sb.AppendLine($"{indentation}            'camera_preset': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.CameraPreset, "angled", "front", "angled", "top", "free"))}',");
        sb.AppendLine($"{indentation}            'aggregation_method': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.AggregationMethod, "sum", "sum", "avg", "max", "min"))}',");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'summary': {{");
        sb.AppendLine($"{indentation}            'grid_size': len({varName}_records),");
        sb.AppendLine($"{indentation}            'excluded_rows': 0,");
        sb.AppendLine($"{indentation}            'top_peaks': {varName}_peaks,");
        sb.AppendLine($"{indentation}            'bottom_valleys': {varName}_valleys,");
        sb.AppendLine($"{indentation}            'warnings': [],");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}    }}");
        StoryStreamlitGeneration.AppendComponentsHtml(
            sb,
            indentation,
            varName,
            TerrainStreamlitHtmlHelper.GetHtmlTemplatePythonLiteral(),
            TerrainStreamlitHtmlHelper.PayloadPlaceholder,
            TerrainStreamlitHtmlHelper.DefaultHeightPx);
    }
}
