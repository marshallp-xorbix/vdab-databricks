using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Layout;

/// <summary>
/// Service for Form component
/// </summary>
public class FormComponentService : BaseComponentService, IFormComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Form;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new FormComponentDto
        {
            Id = "template-form",
            CodeName = "templateForm",
            Type = ComponentType.Form,
            Category = ComponentCategory.Layout,
            Icon = "RectangleVertical",
            SchemaVersion = 1,
            Props = new FormProps
            {
                SubmitButtonText = "Submit",
                ClearOnSubmit = false,
                EnterToSubmit = true,
                Border = true,
                Width = "stretch",
                Height = "content",
            },
            SupportedEvents = new List<string> { "onSubmit" }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        FormComponentDto form = (FormComponentDto)component;

        string submitButtonText = form.Props.SubmitButtonText ?? "Submit";
        bool clearOnSubmit = form.Props.ClearOnSubmit;
        bool enterToSubmit = form.Props.EnterToSubmit;
        bool border = form.Props.Border;
        string width = form.Props.Width;
        string height = form.Props.Height;
        string varName = GetVariableName(component);
        string key = varName;
        string codeName = component.CodeName?.Trim() ?? varName;

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, submitButtonText);
        sb.AppendLine($"{indentation}# Form container");
        sb.AppendLine(
            $"{indentation}with st.form(key=\"{key}\", clear_on_submit={clearOnSubmit}, enter_to_submit={enterToSubmit}, border={border}, width=\"{width}\", height=\"{height}\"):");

        if (component.Children != null && component.Children.Any() && allComponents != null)
        {
            Dictionary<string, VdabComponentDto> componentsById = allComponents
                .GroupBy(childComponent => childComponent.Id)
                .ToDictionary(group => group.Key, group => group.First());

            List<VdabComponentDto> orderedChildren = component.Children
                .Where(childId => !string.IsNullOrWhiteSpace(childId))
                .Select(childId => componentsById.TryGetValue(childId, out VdabComponentDto? childComponent)
                    ? childComponent
                    : null)
                .Where(childComponent => childComponent != null)
                .Cast<VdabComponentDto>()
                .OrderBy(childComponent => LayoutJsonHelper.ParseLayoutY(childComponent.Layout))
                .ToList();

            foreach (VdabComponentDto childComponent in orderedChildren)
            {
                // Use GenerationService for recursive child generation if available
                string childCode = GenerationService != null
                    ? GenerationService.GenerateComponentCode(childComponent, indentation + "    ", allComponents)
                    : $"{indentation}    st.info('Drag components into this form container')";
                sb.AppendLine(childCode);
                sb.AppendLine();
            }
        }
        else
        {
            sb.AppendLine($"{indentation}    st.info('Drag components into this form container')");
        }

        sb.AppendLine($"{indentation}    # Form submit button");
        sb.AppendLine($"{indentation}    submitted = st.form_submit_button(_vdab_disp_lbl_{varName})");
        sb.AppendLine();
        sb.AppendLine($"{indentation}if submitted:");

        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onSubmit");
        if (!string.IsNullOrWhiteSpace(handlerName))
        {
            sb.AppendLine($"{indentation}    {handlerName}()");
        }
        else
        {
            sb.AppendLine($"{indentation}    st.toast('Form submitted successfully!')");
        }

        return sb.ToString().TrimEnd();
    }
}
