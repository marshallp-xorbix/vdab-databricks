using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for TextInput component
/// </summary>
public class TextInputComponentService : BaseComponentService, ITextInputComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.TextInput;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new TextInputComponentDto
        {
            Id = "template-textinput",
            CodeName = "templateTextInput",
            Type = ComponentType.TextInput,
            Category = ComponentCategory.Controls,
            Icon = "Type",
            SchemaVersion = 1,
            Props = new TextInputProps
            {
                Label = "Label",
                Placeholder = "",
                DefaultValue = "",
                Help = "",
                Disabled = false,
                Type = TextInputTypes.Default,
                Multiline = false,
                Height = ""
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
        TextInputComponentDto textInput = (TextInputComponentDto) component;
        if (string.IsNullOrWhiteSpace(textInput.Props.Label))
        {
            throw new ArgumentException($"TextInput component with id '{component.Id}' is missing a label.");
        }
        string varName = GetVariableName(component);
        string label = textInput.Props.Label;
        string? placeholder = textInput.Props.Placeholder;
        string defaultValue = textInput.Props.DefaultValue ?? string.Empty;
        string? help = textInput.Props.Help;
        bool? disabled = textInput.Props.Disabled;
        string? type = textInput.Props.Type;
        string key = varName;
        bool isMultiline = textInput.Props.Multiline;
        string? height = textInput.Props.Height;
        string codeName = component.CodeName?.Trim() ?? varName;
        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        StreamlitUiOverrideSnippets.AppendSessionStateInitIfMissingStringValue(sb, indentation, key, defaultValue);

        if (isMultiline)
        {
            // Use st.text_area for multiline input
            sb.AppendLine($"{indentation}{varName} = st.text_area(");
            sb.AppendLine($"{indentation}    label=_vdab_disp_lbl_{varName},");
            if (!string.IsNullOrWhiteSpace(placeholder))
            {
                sb.AppendLine($"{indentation}    placeholder={WorkflowTemplateHelper.BuildPythonStringLiteral(placeholder)},");
            }
            // TODO - inspect: value= here may conflict with the session_state default seeded above (Streamlit warns when both are set).
            if (!string.IsNullOrWhiteSpace(defaultValue))
            {
                sb.AppendLine($"{indentation}    value={WorkflowTemplateHelper.BuildPythonStringLiteral(defaultValue)},");
            }
            if (!string.IsNullOrWhiteSpace(help))
            {
                sb.AppendLine($"{indentation}    help={WorkflowTemplateHelper.BuildPythonStringLiteral(help)},");
            }
            if (disabled == true)
            {
                sb.AppendLine($"{indentation}    disabled=True,");
            }
            if (!string.IsNullOrWhiteSpace(height))
            {
                if (int.TryParse(height, out int heightValue) && heightValue > 98)
                {
                    sb.AppendLine($"{indentation}    height={heightValue},");
                }
                else
                {
                    sb.AppendLine($"{indentation}    height={WorkflowTemplateHelper.BuildPythonStringLiteral(height)},");
                }
            }
            if (!string.IsNullOrWhiteSpace(handlerName))
            {
                sb.AppendLine($"{indentation}    on_change={handlerName},");
            }
            sb.AppendLine($"{indentation}    key=\"{key}\"");
            sb.AppendLine($"{indentation})");
        }
        else
        {
            // Use st.text_input for single-line input
            sb.AppendLine($"{indentation}{varName} = st.text_input(");
            sb.AppendLine($"{indentation}    label=_vdab_disp_lbl_{varName},");
            if (!string.IsNullOrWhiteSpace(placeholder))
            {
                sb.AppendLine($"{indentation}    placeholder={WorkflowTemplateHelper.BuildPythonStringLiteral(placeholder)},");
            }
            // TODO - inspect: value= here may conflict with the session_state default seeded above (Streamlit warns when both are set).
            if (!string.IsNullOrWhiteSpace(defaultValue))
            {
                sb.AppendLine($"{indentation}    value={WorkflowTemplateHelper.BuildPythonStringLiteral(defaultValue)},");
            }
            if (!string.IsNullOrWhiteSpace(help))
            {
                sb.AppendLine($"{indentation}    help={WorkflowTemplateHelper.BuildPythonStringLiteral(help)},");
            }
            if (disabled == true)
            {
                sb.AppendLine($"{indentation}    disabled=True,");
            }
            if (!string.IsNullOrWhiteSpace(type) && type == TextInputTypes.Password)
            {
                sb.AppendLine($"{indentation}    type={WorkflowTemplateHelper.BuildPythonStringLiteral(type)},");
            }
            if (!string.IsNullOrWhiteSpace(handlerName))
            {
                sb.AppendLine($"{indentation}    on_change={handlerName},");
            }
            sb.AppendLine($"{indentation}    key=\"{key}\"");
            sb.AppendLine($"{indentation})");
        }
        return sb.ToString().TrimEnd();
    }
}
