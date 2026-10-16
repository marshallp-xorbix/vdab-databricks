using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for DatePicker component
/// </summary>
public class DatePickerComponentService : BaseComponentService, IDatePickerComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.DatePicker;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new DatePickerComponentDto
        {
            Id = "template-datepicker",
            CodeName = "templateDatePicker",
            Type = ComponentType.DatePicker,
            Category = ComponentCategory.Controls,
            Icon = "Calendar",
            SchemaVersion = 1,
            Props = new DatePickerProps
            {
                Label = "Select Date",
                DefaultValue = "today",
                MinDate = "",
                MaxDate = "",
                Format = "",
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
        DatePickerComponentDto datePicker = (DatePickerComponentDto) component;
        if (string.IsNullOrWhiteSpace(datePicker.Props.Label))
        {
            throw new ArgumentException("DatePicker component must have a label");
        }
        string varName = GetVariableName(component);
        string label = datePicker.Props.Label;
        string? value = datePicker.Props.DefaultValue;
        string? minDate = datePicker.Props.MinDate;
        string? maxDate = datePicker.Props.MaxDate;
        string? format = datePicker.Props.Format;
        string? help = datePicker.Props.Help;
        bool? disabled = datePicker.Props.Disabled;
        string key = varName;
        string codeName = component.CodeName?.Trim() ?? varName;
        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        sb.AppendLine($"{indentation}{varName} = st.date_input(");
        sb.AppendLine($"{indentation}    label=_vdab_disp_lbl_{varName},");
        if (!string.IsNullOrWhiteSpace(value))
        {
            sb.AppendLine($"{indentation}    value=\"{value}\",");
        }
        if (!string.IsNullOrWhiteSpace(minDate))
        {
            sb.AppendLine($"{indentation}    min_value=\"{minDate}\",");
        }
        if (!string.IsNullOrWhiteSpace(maxDate))
        {
            sb.AppendLine($"{indentation}    max_value=\"{maxDate}\",");
        }
        if (!string.IsNullOrWhiteSpace(format))
        {
            sb.AppendLine($"{indentation}    format=\"{format}\",");
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
