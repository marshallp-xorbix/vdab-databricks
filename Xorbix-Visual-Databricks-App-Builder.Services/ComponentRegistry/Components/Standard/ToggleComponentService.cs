using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for Toggle component
/// </summary>
public class ToggleComponentService : BaseComponentService, IToggleComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Toggle;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new ToggleComponentDto
        {
            Id = "template-toggle",
            CodeName = "templateToggle",
            Type = ComponentType.Toggle,
            Category = ComponentCategory.Controls,
            Icon = "ToggleLeft",
            SchemaVersion = 1,
            Props = new ToggleProps
            {
                Label = "Toggle",
                DefaultValue = false,
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
        ToggleComponentDto toggle = (ToggleComponentDto) component;
        // validate label
        if (string.IsNullOrWhiteSpace(toggle.Props.Label))
        {
            throw new ArgumentException("Label is required for Toggle component");
        }
        string varName = GetVariableName(component);
        string label = toggle.Props.Label;
        bool defaultValue = toggle.Props.DefaultValue;
        string? help = toggle.Props.Help;
        bool? disabled = toggle.Props.Disabled;
        string key = varName;
        string codeName = component.CodeName?.Trim() ?? varName;
        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        StreamlitUiOverrideSnippets.AppendSessionStateInitIfMissingBool(
            sb,
            indentation,
            key,
            defaultValue);

        sb.AppendLine($"{indentation}{varName} = st.toggle(");
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
