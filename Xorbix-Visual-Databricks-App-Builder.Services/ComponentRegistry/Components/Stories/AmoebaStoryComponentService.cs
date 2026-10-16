using System.Globalization;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

/// <summary>
/// Service for Amoeba Story visualization component.
/// </summary>
public class AmoebaStoryComponentService : BaseComponentService, IAmoebaStoryComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.AmoebaStory;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new AmoebaStoryComponentDto
        {
            Id = "template-amoebastory",
            CodeName = "templateAmoebaStory",
            Type = ComponentType.AmoebaStory,
            Category = ComponentCategory.Visualization,
            Icon = "AmoebaStory",
            SchemaVersion = 1,
            Props = StoryComponentDefaults.CreateAmoebaProps("Amoeba Story"),
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
        AmoebaStoryComponentDto amoeba = (AmoebaStoryComponentDto)component;
        string varName = GetVariableName(component);

        if (!StoryStreamlitGeneration.TryAppendQueryAndFetch(
                sb,
                indentation,
                component,
                varName,
                amoeba.Props.Title ?? "Amoeba Story",
                "Bind a table and map entity, size, and position fields to render this visualization.",
                bindingContext => AmoebaQueryBuilder.BuildSql(bindingContext, amoeba.Props),
                "Fetch data for Amoeba Story"))
        {
            return sb.ToString().TrimEnd();
        }

        AppendPayloadAndHtml(sb, indentation, varName, amoeba.Props);
        return sb.ToString().TrimEnd();
    }

    private static void AppendPayloadAndHtml(
        StringBuilder sb,
        string indentation,
        string varName,
        AmoebaStoryProps props)
    {
        sb.AppendLine($"{indentation}if {varName}_data is None or {varName}_data.empty or 'entity_id' not in {varName}_data.columns:");
        sb.AppendLine($"{indentation}    st.info('No amoeba records returned. Check bindings and field mappings.')");
        sb.AppendLine($"{indentation}else:");
        StoryStreamlitGeneration.AppendNumericCoerce(
            sb,
            indentation,
            varName,
            ["size_value", "x_value", "y_value", "change_value", "health_score", "risk_score"]);
        sb.AppendLine($"{indentation}    {varName}_df = {varName}_df.dropna(subset=['entity_id'])");
        AppendRecordLoop(sb, indentation, varName);
        AppendPayload(sb, indentation, varName, props);
    }

    private static void AppendRecordLoop(StringBuilder sb, string indentation, string varName)
    {
        sb.AppendLine($"{indentation}    {varName}_records = []");
        sb.AppendLine($"{indentation}    for _, _row in {varName}_df.iterrows():");
        sb.AppendLine($"{indentation}        _rec = {{");
        sb.AppendLine($"{indentation}            'entity_id': None if pd.isna(_row.get('entity_id')) else _row.get('entity_id'),");
        sb.AppendLine($"{indentation}            'entity_label': '' if pd.isna(_row.get('entity_label', '')) else str(_row.get('entity_label', '')),");
        sb.AppendLine($"{indentation}            'category': '' if pd.isna(_row.get('category', '')) else str(_row.get('category', '')),");
        sb.AppendLine($"{indentation}            'size_value': None if pd.isna(_row.get('size_value')) else float(_row.get('size_value')),");
        sb.AppendLine($"{indentation}            'x_value': None if pd.isna(_row.get('x_value')) else float(_row.get('x_value')),");
        sb.AppendLine($"{indentation}            'y_value': None if pd.isna(_row.get('y_value')) else float(_row.get('y_value')),");
        sb.AppendLine($"{indentation}            'change_value': None if pd.isna(_row.get('change_value')) else float(_row.get('change_value')),");
        sb.AppendLine($"{indentation}        }}");
        sb.AppendLine($"{indentation}        if 'health_score' in {varName}_df.columns and not pd.isna(_row.get('health_score')):");
        sb.AppendLine($"{indentation}            _rec['health_score'] = float(_row.get('health_score'))");
        sb.AppendLine($"{indentation}        if 'risk_score' in {varName}_df.columns and not pd.isna(_row.get('risk_score')):");
        sb.AppendLine($"{indentation}            _rec['risk_score'] = float(_row.get('risk_score'))");
        sb.AppendLine($"{indentation}        {varName}_records.append(_rec)");
    }

    private static void AppendPayload(
        StringBuilder sb,
        string indentation,
        string varName,
        AmoebaStoryProps props)
    {
        sb.AppendLine($"{indentation}    {varName}_payload = {{");
        sb.AppendLine($"{indentation}        'records': {varName}_records,");
        sb.AppendLine($"{indentation}        'visualConfig': {{");
        sb.AppendLine($"{indentation}            'layout_mode': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.LayoutMode, "hybrid", "scatter", "cluster", "hybrid"))}',");
        sb.AppendLine($"{indentation}            'size_scale': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.SizeScale, "sqrt", "linear", "sqrt", "log"))}',");
        sb.AppendLine($"{indentation}            'min_radius_px': {Math.Clamp(props.MinRadiusPx, 8, 200)},");
        sb.AppendLine($"{indentation}            'max_radius_px': {Math.Clamp(props.MaxRadiusPx, 16, 300)},");
        sb.AppendLine($"{indentation}            'color_by': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.ColorBy, "category", "health_score", "category"))}',");
        sb.AppendLine($"{indentation}            'pulse_by': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.PulseBy, "risk_score", "none", "risk_score"))}',");
        sb.AppendLine($"{indentation}            'pulse_threshold': {Math.Clamp(props.PulseThreshold, 0, 100).ToString(CultureInfo.InvariantCulture)},");
        sb.AppendLine($"{indentation}            'pulse_threshold_mode': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.PulseThresholdMode, "above", "above", "below"))}',");
        sb.AppendLine($"{indentation}            'shape_variation': {Math.Clamp(props.ShapeVariation, 0, 1).ToString(CultureInfo.InvariantCulture)},");
        sb.AppendLine($"{indentation}            'label_mode': '{EscapePythonSingleQuoted(StoryEnumNormalizer.Normalize(props.LabelMode, "compact", "none", "compact", "full"))}',");
        sb.AppendLine($"{indentation}            'animation_enabled': {ToPythonBool(props.AnimationEnabled)},");
        sb.AppendLine($"{indentation}            'animation_speed': {Math.Clamp(props.AnimationSpeed, 0.25, 3).ToString(CultureInfo.InvariantCulture)},");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}        'summary': {{");
        sb.AppendLine($"{indentation}            'total_entities': len({varName}_records),");
        sb.AppendLine($"{indentation}            'excluded_rows': 0,");
        sb.AppendLine($"{indentation}            'warnings': [],");
        sb.AppendLine($"{indentation}        }},");
        sb.AppendLine($"{indentation}    }}");
        StoryStreamlitGeneration.AppendComponentsHtml(
            sb,
            indentation,
            varName,
            AmoebaStreamlitHtmlHelper.GetHtmlTemplatePythonLiteral(),
            AmoebaStreamlitHtmlHelper.PayloadPlaceholder,
            AmoebaStreamlitHtmlHelper.DefaultHeightPx);
    }
}
