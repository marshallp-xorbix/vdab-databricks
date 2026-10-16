using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for Dropdown component
/// </summary>
public class DropdownComponentService : BaseComponentService, IDropdownComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Dropdown;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new DropdownComponentDto
        {
            Id = "template-dropdown",
            CodeName = "templateDropdown",
            Type = ComponentType.Dropdown,
            Category = ComponentCategory.Controls,
            Icon = "ChevronDown",
            SchemaVersion = 1,
            Props = new DropdownProps
            {
                Label = "Select an option",
                Options = new List<DropdownOptionDto>
                {
                    new DropdownOptionDto { Value = "1" },
                    new DropdownOptionDto { Value = "2" }
                },
                DefaultValue = "",
                Disabled = false,
                Help = "",
                Placeholder = "Select an option",
                Multiselect = false
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
        DropdownComponentDto dropdown = (DropdownComponentDto) component;
        // validate label
        if (string.IsNullOrWhiteSpace(dropdown.Props.Label))
        {
            throw new ArgumentException("Label is required for Dropdown component");
        }
        // validate options
        if (dropdown.Props.Options == null || dropdown.Props.Options.Count == 0)
        {
            throw new ArgumentException("At least one option is required for Dropdown component");
        }
        string varName = GetVariableName(component);
        string label = dropdown.Props.Label;
        List<DropdownOptionDto> items = dropdown.Props.Options;
        string itemsStr = string.Join(", ", items.Select(i => $"\"{i.Value}\""));
        string? defaultIndex = dropdown.Props.DefaultValue;
        int? defaultIndexInt = null;
        if (!string.IsNullOrWhiteSpace(defaultIndex) && defaultIndex != "None")
        {
            defaultIndexInt = FindIndex(items, defaultIndex);
        }
        bool? disabled = dropdown.Props.Disabled;
        string? help = dropdown.Props.Help;
        string? placeholder = dropdown.Props.Placeholder;
        string key = varName;
        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");
        bool multiselect = dropdown.Props.Multiselect;
        string codeName = component.CodeName?.Trim() ?? varName;

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);

        if (multiselect)
        {
            List<string> initialSelection = string.IsNullOrWhiteSpace(defaultIndex)
                ? new List<string>()
                : new List<string> { defaultIndex };
            StreamlitUiOverrideSnippets.AppendSessionStateInitIfMissing(
                sb,
                indentation,
                key,
                StreamlitUiOverrideSnippets.BuildPythonStringListLiteral(initialSelection));
        }
        else
        {
            string defaultSelected = items[0].Value;
            if (defaultIndexInt != null &&
                defaultIndexInt.Value >= 0 &&
                defaultIndexInt.Value < items.Count)
            {
                defaultSelected = items[defaultIndexInt.Value].Value;
            }

            StreamlitUiOverrideSnippets.AppendSessionStateInitIfMissingStringValue(
                sb,
                indentation,
                key,
                defaultSelected);
        }

        sb.AppendLine($"{indentation}{varName} = st.{(multiselect ? "multiselect" : "selectbox")}(");
        sb.AppendLine($"{indentation}    label=_vdab_disp_lbl_{varName},");
        sb.AppendLine($"{indentation}    options=[{itemsStr}],");
        
        if (!string.IsNullOrWhiteSpace(help))
        {
            sb.AppendLine($"{indentation}    help=\"{help}\",");
        }
        if (disabled != null)
        {
            sb.AppendLine($"{indentation}    disabled={ToPythonBool((bool) disabled)},");
        }
        if (!string.IsNullOrWhiteSpace(placeholder))
        {
            sb.AppendLine($"{indentation}    placeholder=\"{placeholder}\",");
        }
        if (!string.IsNullOrWhiteSpace(handlerName))
        {
            sb.AppendLine($"{indentation}    on_change={handlerName},");
        }
        sb.AppendLine($"{indentation}    key=\"{key}\"");
        sb.AppendLine($"{indentation})");
        return sb.ToString().TrimEnd();
    }

    private static int? FindIndex(List<DropdownOptionDto> options, string? defaultValue)
    {
        for (int i = 0; i < options.Count; i++)
        {
            if (options[i].Value == defaultValue)
            {
                return i;
            }
        }
        return null;
    }
}