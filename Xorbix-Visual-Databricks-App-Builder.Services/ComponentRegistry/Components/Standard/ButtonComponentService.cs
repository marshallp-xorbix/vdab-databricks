using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for Button component
/// </summary>
public class ButtonComponentService : BaseComponentService, IButtonComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Button;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new ButtonComponentDto
        {
            Id = "template-button",
            CodeName = "templateButton",
            Type = ComponentType.Button,
            Category = ComponentCategory.Controls,
            Icon = "MousePointerClick",
            SchemaVersion = 1,
            Props = new ButtonProps
            {
                Label = "Click Me",
                Variant = "primary",
                Disabled = false, 
                Help = ""
            },
            SupportedEvents = new List<string> { "onClick" }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        ButtonComponentDto button = (ButtonComponentDto) component;
        // validate label
        if (string.IsNullOrWhiteSpace(button.Props.Label))
        {
            throw new ArgumentException("Label is required for Button component");
        }
        string varName = GetVariableName(component);
        string label = button.Props.Label;
        string key = varName;
        string codeName = component.CodeName?.Trim() ?? varName;
        string? typeVariant = button.Props.Variant;
        bool? disabled = button.Props.Disabled;
        string? help = button.Props.Help;
        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        // Button declaration
        sb.AppendLine($"{indentation}{varName} = st.button(");
        sb.AppendLine($"{indentation}    label=_vdab_disp_lbl_{varName},");
        sb.AppendLine($"{indentation}    key=\"{key}\",");
        if (!string.IsNullOrWhiteSpace(typeVariant))
        {
            sb.AppendLine($"{indentation}    type=\"{typeVariant}\",");
        }
        if (disabled != null)
        {
            sb.AppendLine($"{indentation}    disabled={ToPythonBool((bool) disabled)},");
        }
        if (!string.IsNullOrWhiteSpace(help))
        {
            sb.AppendLine($"{indentation}    help=\"{help}\",");
        }
        // Button action
        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onClick");
        if (!string.IsNullOrWhiteSpace(handlerName))
        {
            sb.AppendLine($"{indentation}    on_click={handlerName},");
        }
        sb.AppendLine($"{indentation})");

        return sb.ToString().TrimEnd();
    }
}
