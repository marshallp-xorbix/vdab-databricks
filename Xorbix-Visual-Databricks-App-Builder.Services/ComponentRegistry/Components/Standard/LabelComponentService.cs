using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for Label component
/// </summary>
public class LabelComponentService : BaseComponentService, ILabelComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Label;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new LabelComponentDto
        {
            Id = "template-label",
            CodeName = "templateLabel",
            Type = ComponentType.Label,
            Category = ComponentCategory.Controls,
            Icon = "Text",
            SchemaVersion = 1,
            Props = new LabelProps
            {
                Text = "Label Text",
                FontSize = "medium",
                Bold = false
            }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        LabelComponentDto? label = component as LabelComponentDto;
        if (label == null)
            return $"{indentation}st.error('Invalid Label component')";

        string? text = label.Props.Text;
        string? fontSize = label.Props.FontSize;
        bool bold = label.Props.Bold;
        string varName = GetVariableName(component);
        string codeName = component.CodeName?.Trim() ?? varName;

        // Map font sizes
        var fontSizeMap = new Dictionary<string, string>
        {
            { "small", "16px" },
            { "medium", "20px" },
            { "large", "28px" }
        };

        var size = fontSize != null && fontSizeMap.ContainsKey(fontSize) ? fontSizeMap[fontSize] : fontSizeMap["medium"];
        var weight = bold ? "bold" : "normal";

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, text ?? string.Empty);
        sb.AppendLine($"{indentation}st.markdown(");
        sb.AppendLine($"{indentation}    f'<p style=\"font-size: {size}; font-weight: {weight}; margin: 0;\">{{_vdab_disp_lbl_{varName}}}</p>',");
        sb.AppendLine($"{indentation}    unsafe_allow_html=True");
        sb.AppendLine($"{indentation})");

        return sb.ToString().TrimEnd();
    }
}
