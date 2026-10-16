using System.Text;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure.Internal;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for Slider component
/// </summary>
public class SliderComponentService : BaseComponentService, ISliderComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Slider;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new SliderComponentDto
        {
            Id = "template-slider",
            CodeName = "templateSlider",
            Type = ComponentType.Slider,
            Category = ComponentCategory.Controls,
            Icon = "SlidersHorizontal",
            SchemaVersion = 1,
            Props = new SliderProps
            {
                Label = "Slider",
                MinValue = 0,
                MaxValue = 100,
                DefaultValue = 50,
                UpperValue = 60,
                Step = 1,
                Disabled = false,
                Help = "",
                Ranged = false,
                Format = ""
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
        SliderComponentDto slider = (SliderComponentDto) component;
        if (string.IsNullOrWhiteSpace(slider.Props.Label))
        {
            throw new ArgumentException("Slider label is required");
        }
        if (slider.Props.Ranged == null)
        {
            throw new ArgumentException("Slider ranged property is required");
        }
        string varName = GetVariableName(component);
        string label = slider.Props.Label;
        double? minValue = slider.Props.MinValue;
        double? maxValue = slider.Props.MaxValue;
        double? defaultValue = slider.Props.DefaultValue;
        double? upperValue = slider.Props.UpperValue;
        double? step = slider.Props.Step;
        bool? disabled = slider.Props.Disabled;
        string? help = slider.Props.Help;
        bool ranged = slider.Props.Ranged;
        string? format = slider.Props.Format;
        string key = varName;
        string codeName = component.CodeName?.Trim() ?? varName;
        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        sb.AppendLine($"{indentation}{varName} = st.slider(");
        sb.AppendLine($"{indentation}    label=\"{label}\",");
        if (minValue != null)
        {
            sb.AppendLine($"{indentation}    min_value={(double) minValue},");
        }
        if (maxValue != null)
        {
            sb.AppendLine($"{indentation}    max_value={(double) maxValue},");
        }
        if (defaultValue != null)
        {
            string valueStr = (ranged) ? $"({defaultValue},{upperValue})" : $"{defaultValue}";
            sb.AppendLine($"{indentation}    value={valueStr},");
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
        if (!string.IsNullOrWhiteSpace(format))
        {
            sb.AppendLine($"{indentation}    format=\"{format}\",");
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
