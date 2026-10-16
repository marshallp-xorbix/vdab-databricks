using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for TimePicker component
/// </summary>
public class TimePickerComponentService : BaseComponentService, ITimePickerComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.TimePicker;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new TimePickerComponentDto
        {
            Id = "template-timepicker",
            CodeName = "templateTimePicker",
            Type = ComponentType.TimePicker,
            Category = ComponentCategory.Controls,
            Icon = "Clock",
            SchemaVersion = 1,
            Props = new TimePickerProps
            {
                Label = "Select Time",
                DefaultValue = "now",
                Step = 900,
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
        TimePickerComponentDto timePicker = (TimePickerComponentDto) component;
        if (string.IsNullOrWhiteSpace(timePicker.Props.Label))
        {
            throw new ArgumentException("TimePicker component must have a label");
        }
        string varName = GetVariableName(component);
        string label = timePicker.Props.Label;
        string? value = timePicker.Props.DefaultValue;
        int? step = timePicker.Props.Step;
        string? help = timePicker.Props.Help;
        bool? disabled = timePicker.Props.Disabled;
        string key = varName;
        string codeName = component.CodeName?.Trim() ?? varName;
        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        sb.AppendLine($"{indentation}{varName} = st.time_input(");
        sb.AppendLine($"{indentation}    label=_vdab_disp_lbl_{varName},");
        if (!string.IsNullOrWhiteSpace(value))
        {
            sb.AppendLine($"{indentation}    value=\"{value}\",");
        }
        if (step != null)
        {
            sb.AppendLine($"{indentation}    step={step},");
        }
        if (disabled != null)
        {
            sb.AppendLine($"{indentation}    disabled={ToPythonBool((bool) disabled)},");
        }        
        if (!string.IsNullOrWhiteSpace(help))
        {
            sb.AppendLine($"{indentation}    help=\"{help}\",");
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
