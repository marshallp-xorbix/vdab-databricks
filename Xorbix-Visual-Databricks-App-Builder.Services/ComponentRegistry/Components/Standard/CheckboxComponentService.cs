using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for Checkbox component
/// </summary>
public class CheckboxComponentService : BaseComponentService, ICheckboxComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Checkbox;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new CheckboxComponentDto
        {
            Id = "template-checkbox",
            CodeName = "templateCheckbox",
            Type = ComponentType.Checkbox,
            Category = ComponentCategory.Controls,
            Icon = "CheckSquare",
            SchemaVersion = 1,
            Props = new CheckboxProps
            {
                Label = "Checkbox",
                DefaultChecked = false,
                Help = "",
                Disabled = false
            },
            SupportedEvents = new List<string> { "onChange" }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        CheckboxComponentDto checkbox = (CheckboxComponentDto) component;
        // validate label
        if (string.IsNullOrWhiteSpace(checkbox.Props.Label))
        {
            throw new ArgumentException("Label is required for Checkbox component");
        }
        string varName = GetVariableName(component);
        string label = checkbox.Props.Label;
        bool defaultChecked = checkbox.Props.DefaultChecked;
        string key = varName;
        string codeName = component.CodeName?.Trim() ?? varName;
        string? help = checkbox.Props.Help;
        bool? disabled = checkbox.Props.Disabled;

        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        StreamlitUiOverrideSnippets.AppendSessionStateInitIfMissingBool(
            sb,
            indentation,
            key,
            defaultChecked);

        sb.AppendLine($"{indentation}{varName} = st.checkbox(");
        sb.AppendLine($"{indentation}    label=_vdab_disp_lbl_{varName},");
        if (!string.IsNullOrWhiteSpace(help))
        {
            sb.AppendLine($"{indentation}    help=\"{help}\",");
        }
        if (disabled != null)
        {
            sb.AppendLine($"{indentation}    disabled={ToPythonBool((bool) disabled)},");
        }
        if (!string.IsNullOrWhiteSpace(handlerName))
        {
            sb.AppendLine($"{indentation}    on_change={handlerName},");
        }
        sb.AppendLine($"{indentation}    key=\"{key}\"");
        sb.AppendLine($"{indentation})");

        return sb.ToString().TrimEnd();
    }
}